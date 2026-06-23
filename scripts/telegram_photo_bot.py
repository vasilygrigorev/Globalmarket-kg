#!/usr/bin/env python3
import argparse
import json
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PHOTO_BOT = ROOT / "scripts" / "local_photo_bot.py"
INBOX = ROOT / "assets" / "telegram_inbox"
UPLOADS = ROOT / "assets" / "telegram_uploads"
DEFAULT_OBJECT_FILL = "0.8"


def slugify(value):
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9а-яё]+", "-", value, flags=re.IGNORECASE)
    value = re.sub(r"-+", "-", value).strip("-")
    return value[:80] or f"product-{int(time.time())}"


def safe_filename(value):
    path = Path(value)
    stem = re.sub(r"[^a-zA-Z0-9а-яА-ЯёЁ._ -]+", "-", path.stem).strip(" .-")
    suffix = re.sub(r"[^a-zA-Z0-9.]+", "", path.suffix.lower())
    return f"{stem[:90] or 'telegram-file'}{suffix}"


def unique_path(path):
    if not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    for index in range(2, 1000):
        candidate = path.with_name(f"{stem}-{index}{suffix}")
        if not candidate.exists():
            return candidate
    return path.with_name(f"{stem}-{int(time.time())}{suffix}")


class TelegramApi:
    def __init__(self, token):
        self.token = token
        self.api_base = f"https://api.telegram.org/bot{token}"
        self.file_base = f"https://api.telegram.org/file/bot{token}"

    def request_json(self, method, payload=None, timeout=60):
        data = None
        headers = {}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(f"{self.api_base}/{method}", data=data, headers=headers)
        with urllib.request.urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
        if not result.get("ok"):
            raise RuntimeError(f"Telegram API error: {result}")
        return result["result"]

    def get_updates(self, offset, timeout):
        payload = {
            "offset": offset,
            "timeout": timeout,
            "allowed_updates": ["message"],
        }
        return self.request_json("getUpdates", payload=payload, timeout=timeout + 10)

    def send_message(self, chat_id, text):
        return self.request_json("sendMessage", payload={"chat_id": chat_id, "text": text})

    def get_file_path(self, file_id):
        result = self.request_json("getFile", payload={"file_id": file_id})
        return result["file_path"]

    def download_file(self, file_path, destination):
        url = f"{self.file_base}/{file_path}"
        with urllib.request.urlopen(url, timeout=60) as response:
            destination.write_bytes(response.read())

    def send_document(self, chat_id, path, caption=None):
        fields = {"chat_id": str(chat_id)}
        if caption:
            fields["caption"] = caption
        files = {"document": path}
        body, content_type = multipart_form_data(fields, files)
        request = urllib.request.Request(
            f"{self.api_base}/sendDocument",
            data=body,
            headers={"Content-Type": content_type},
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
        if not result.get("ok"):
            raise RuntimeError(f"Telegram upload error: {result}")
        return result["result"]


def multipart_form_data(fields, files):
    boundary = f"----codex{uuid.uuid4().hex}"
    chunks = []
    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                str(value).encode("utf-8"),
                b"\r\n",
            ]
        )
    for name, path in files.items():
        path = Path(path)
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"; filename="{path.name}"\r\n'.encode(),
                f"Content-Type: {mime}\r\n\r\n".encode(),
                path.read_bytes(),
                b"\r\n",
            ]
        )
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


class PhotoSession:
    def __init__(self, chat_id, slug):
        self.chat_id = chat_id
        self.slug = slug
        self.photos = []
        self.updated_at = time.monotonic()

    def add_photo(self, path):
        self.photos.append(path)
        self.updated_at = time.monotonic()


class PhotoBot:
    def __init__(self, api, quiet_seconds, object_fill):
        self.api = api
        self.quiet_seconds = quiet_seconds
        self.object_fill = str(object_fill)
        self.sessions = {}
        self.chat_slugs = {}

    def run(self):
        self.api.send_message_to_log = None
        offset = None
        print("Telegram photo bot started.")
        while True:
            try:
                updates = self.api.get_updates(offset=offset, timeout=20)
                for update in updates:
                    offset = update["update_id"] + 1
                    self.handle_update(update)
                self.process_ready_sessions()
            except KeyboardInterrupt:
                print("Stopped.")
                return
            except Exception as error:
                print(f"Error: {error}")
                time.sleep(3)

    def handle_update(self, update):
        message = update.get("message") or {}
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        if not chat_id:
            return

        text = (message.get("text") or "").strip()
        if text:
            self.handle_text(chat_id, text)
            return

        photos = message.get("photo") or []
        document = message.get("document")
        if document:
            self.handle_document(chat_id, document)
            return

        if not photos:
            return

        caption = (message.get("caption") or "").strip()
        slug = slugify(caption) if caption else self.chat_slugs.get(chat_id)
        if not slug:
            slug = f"telegram-{chat_id}-{int(time.time())}"
            self.chat_slugs[chat_id] = slug

        session = self.sessions.get(chat_id)
        if not session or session.slug != slug:
            session = PhotoSession(chat_id, slug)
            self.sessions[chat_id] = session

        photo = max(photos, key=lambda item: item.get("file_size", 0))
        saved = self.download_photo(slug, photo["file_id"], len(session.photos) + 1)
        session.add_photo(saved)
        self.api.send_message(chat_id, f"Фото принято: {len(session.photos)}. Обработаю через {self.quiet_seconds} сек после последнего фото.")

    def handle_document(self, chat_id, document):
        filename = document.get("file_name") or f"telegram-file-{int(time.time())}"
        suffix = Path(filename).suffix.lower()
        target_dir = UPLOADS / ("stock" if suffix in {".mxl", ".xls", ".xlsx", ".csv"} else "other")
        target_dir.mkdir(parents=True, exist_ok=True)
        safe_name = safe_filename(filename)
        target = unique_path(target_dir / safe_name)
        file_path = self.api.get_file_path(document["file_id"])
        self.api.download_file(file_path, target)

        if suffix in {".mxl", ".xls", ".xlsx", ".csv"}:
            self.api.send_message(chat_id, f"Выгрузку сохранил: {target.relative_to(ROOT)}")
        else:
            self.api.send_message(chat_id, f"Файл сохранил: {target.relative_to(ROOT)}")

    def handle_text(self, chat_id, text):
        if text == "/start":
            self.api.send_message(
                chat_id,
                "Пришлите 1-2 фото товара. Команды: /slug clear-men-cr7-600ml, /process, /clear. "
                "Фото обработаются локально: обрезка, пропорции, фон, 1200x1200.",
            )
            return
        if text.startswith("/slug"):
            slug = slugify(text.replace("/slug", "", 1))
            self.chat_slugs[chat_id] = slug
            self.sessions.pop(chat_id, None)
            self.api.send_message(chat_id, f"Ок, текущий товар: {slug}. Теперь пришлите фото.")
            return
        if text == "/process":
            session = self.sessions.get(chat_id)
            if not session or not session.photos:
                self.api.send_message(chat_id, "Пока нет фото для обработки.")
                return
            self.process_session(session)
            return
        if text == "/clear":
            self.sessions.pop(chat_id, None)
            self.api.send_message(chat_id, "Очистил текущую пачку фото.")
            return
        self.api.send_message(chat_id, "Не понял команду. Используйте /slug, /process или просто пришлите фото.")

    def download_photo(self, slug, file_id, index):
        file_path = self.api.get_file_path(file_id)
        suffix = Path(file_path).suffix or ".jpg"
        target_dir = INBOX / slug
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{index:02d}-telegram{suffix.lower()}"
        self.api.download_file(file_path, target)
        return target

    def process_ready_sessions(self):
        now = time.monotonic()
        for session in list(self.sessions.values()):
            if session.photos and now - session.updated_at >= self.quiet_seconds:
                self.process_session(session)

    def process_session(self, session):
        labels = ["front", "back"][: len(session.photos)]
        if len(session.photos) > 2:
            labels = [f"photo-{idx}" for idx in range(1, len(session.photos) + 1)]

        command = [
            "python3",
            str(PHOTO_BOT),
            session.slug,
            *[str(path) for path in session.photos],
            "--labels",
            *labels,
            "--object-fill",
            self.object_fill,
        ]
        try:
            result = subprocess.run(command, cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            summary = json.loads(result.stdout)
            outputs = [Path(path) for path in summary["outputs"]]
            for index, output in enumerate(outputs, start=1):
                self.api.send_document(session.chat_id, output, caption=f"{session.slug}: обработанное фото {index}/{len(outputs)}")
            self.api.send_message(session.chat_id, f"Готово. Обработано фото: {len(outputs)}.")
        except subprocess.CalledProcessError as error:
            self.api.send_message(session.chat_id, f"Не смог обработать фото: {error.stderr.strip() or error}")
        except Exception as error:
            self.api.send_message(session.chat_id, f"Ошибка обработки: {error}")
        finally:
            self.sessions.pop(session.chat_id, None)


def main():
    parser = argparse.ArgumentParser(description="Telegram wrapper for local product photo processing.")
    parser.add_argument("--token", default=os.environ.get("TELEGRAM_BOT_TOKEN"), help="Telegram bot token. Prefer TELEGRAM_BOT_TOKEN env.")
    parser.add_argument("--quiet-seconds", type=int, default=4, help="Wait after the last photo before processing.")
    parser.add_argument("--object-fill", default=DEFAULT_OBJECT_FILL, help="Target longest side fill inside square frame.")
    args = parser.parse_args()

    if not args.token:
        raise SystemExit("Set TELEGRAM_BOT_TOKEN or pass --token.")

    INBOX.mkdir(parents=True, exist_ok=True)
    UPLOADS.mkdir(parents=True, exist_ok=True)
    bot = PhotoBot(TelegramApi(args.token), quiet_seconds=args.quiet_seconds, object_fill=args.object_fill)
    bot.run()


if __name__ == "__main__":
    main()
