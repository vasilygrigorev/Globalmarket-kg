import { digitsOnly, str } from "./orders.js";
import { sendManagerEmail } from "./manager-email.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function normalizeContactRequest(payload) {
  if (!payload || typeof payload !== "object") return { error: "invalid_json" };
  const name = str(payload.name, 200);
  const phone = str(payload.phone, 60);
  const phoneDigits = digitsOnly(phone);
  const email = str(payload.email, 300);
  const message = str(payload.message, 4000);
  if (!name) return { error: "missing_name" };
  if (phoneDigits.length < 6) return { error: "invalid_phone" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "invalid_email" };
  if (!message) return { error: "missing_message" };
  return { request: { name, phone, email, message } };
}

export function buildContactEmail(contact) {
  return {
    subject: `Новое обращение Global Market KG — ${contact.name}`,
    text: [
      "Новое сообщение из личного кабинета",
      "",
      `Имя: ${contact.name}`,
      `Телефон: ${contact.phone}`,
      `Email: ${contact.email || "не указан"}`,
      "",
      "Сообщение:",
      contact.message,
    ].join("\n"),
  };
}

async function storeContactRequest(env, contact) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { attempted: false, stored: false, reason: "database_not_configured" };
  }
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/contact_requests`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(contact),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase contact_requests insert failed: ${res.status} ${detail}`);
  }
  return { attempted: true, stored: true };
}

export async function onRequestPost(context) {
  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const normalized = normalizeContactRequest(payload);
  if (normalized.error) return json({ ok: false, error: normalized.error }, 400);

  let database = { attempted: false, stored: false };
  let email = { attempted: false, sent: false };
  try {
    database = await storeContactRequest(context.env, normalized.request);
  } catch (error) {
    database = { attempted: true, stored: false, reason: String(error?.message || error) };
  }
  try {
    email = await sendManagerEmail(context.env, buildContactEmail(normalized.request));
  } catch (error) {
    email = { attempted: true, sent: false, reason: String(error?.message || error) };
  }

  if (!database.stored && !email.sent) {
    return json({ ok: false, error: "delivery_failed", database, email }, 500);
  }
  return json({ ok: true, database, email_notification: email });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  return onRequestPost(context);
}
