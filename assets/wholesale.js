(() => {
  const form = document.querySelector("#wholesalePublicForm");
  const status = document.querySelector("#wholesalePublicStatus");
  const previewNote = document.querySelector("#wholesalePreviewNote");
  if (!form || !status) return;

  const isProduction = window.location.hostname === "globalmarket.kg";
  if (!isProduction && previewNote) previewNote.hidden = false;

  function setStatus(message, state = "") {
    status.textContent = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const submit = form.querySelector("button[type='submit']");
    const data = new FormData(form);
    const payload = {
      shop_name: String(data.get("shop_name") || "").trim(),
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      address: String(data.get("address") || "").trim(),
      comment: String(data.get("comment") || "").trim(),
    };

    if (!isProduction) {
      setStatus("Форма заполнена правильно. В тестовой версии заявка не отправлена.", "success");
      return;
    }

    submit.disabled = true;
    setStatus("Отправляем заявку...");
    try {
      const response = await fetch("/api/wholesale-application", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "request_failed");
      form.reset();
      setStatus("Заявка отправлена. Менеджер свяжется с вами.", "success");
    } catch {
      setStatus("Не получилось отправить заявку. Напишите менеджеру в WhatsApp.", "error");
    } finally {
      submit.disabled = false;
    }
  });
})();
