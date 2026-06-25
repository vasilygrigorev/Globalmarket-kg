// Pure, dependency-free helpers for the admin orders page.
// No DOM, no network, no Supabase import — so it is unit-testable in Node.
// admin.js imports these; admin.logic.test.mjs tests them.

export const STATUSES = ["new", "contacted", "confirmed", "completed", "cancelled"];

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}

export function money(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("ru-RU")} сом`;
}

export function when(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString("ru-RU");
}

// Is the page configured with a real Supabase URL + anon key?
export function isConfigured({ url, key, missing } = {}) {
  if (missing) return false;
  const okUrl = typeof url === "string" && url.startsWith("http") && !url.includes("YOUR-PROJECT");
  const okKey = typeof key === "string" && key.length > 0 && !key.includes("YOUR-ANON");
  return Boolean(okUrl && okKey);
}

// Build the PostgREST `.or(...)` filter for a phone/name search (or null).
// Strips characters that would break the or-filter grammar.
export function buildSearchOr(q) {
  const term = String(q ?? "").trim().replace(/[(),%]/g, "");
  if (!term) return null;
  return `customer_phone.ilike.%${term}%,customer_name.ilike.%${term}%`;
}

export function isValidStatus(status) {
  return STATUSES.includes(status);
}

// Friendly, user-facing message for a Supabase/PostgREST error.
export function friendlyError(error) {
  if (!error) return "";
  const msg = String(error.message || error);
  if (/jwt|expired|token/i.test(msg)) return "Сессия истекла — войдите снова.";
  if (/permission|rls|denied|not allowed/i.test(msg)) return "Нет прав администратора для этого действия.";
  if (/network|fetch|failed to fetch/i.test(msg)) return "Нет связи с сервером. Проверьте интернет и попробуйте снова.";
  return msg;
}

// Empty-state text for the orders table (distinguishes filtered vs truly empty).
export function emptyOrdersMessage({ status, q } = {}) {
  if (status || (q && String(q).trim())) {
    return "По этому фильтру заказов нет. Сбросьте фильтр или измените поиск.";
  }
  return "Заказов пока нет (или у вас нет прав администратора).";
}

export function renderStatusOptions(current) {
  return STATUSES
    .map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${s}</option>`)
    .join("");
}

export function renderOrderRow(o) {
  return `
    <tr data-id="${esc(o.id)}" style="cursor:pointer;">
      <td>${esc(when(o.created_at))}</td>
      <td>${esc(o.customer_name)}</td>
      <td>${esc(o.customer_phone)}</td>
      <td>${esc(o.city)}</td>
      <td>${esc(money(o.total_kgs))}</td>
      <td><span class="status">${esc(o.status)}</span></td>
      <td>${esc(o.customer_source)}</td>
    </tr>`;
}
