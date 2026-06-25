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

// Fast client-side guard for the admin UI. RLS remains the real protection.
export function isAdminSession(session) {
  return session?.user?.app_metadata?.is_admin === true;
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

// Which view to show given the current auth session. Pure (no DOM).
export function nextView(session) {
  if (!session) return "login";
  if (!isAdminSession(session)) return "access";
  return "list";
}

export function renderItemsRows(items) {
  const rows = (items || []).map((it) => `
    <tr><td>${esc(it.title_snapshot)}</td><td>${esc(it.qty)}</td>
    <td>${esc(money(it.price_kgs))}</td><td>${esc(money(it.line_total_kgs))}</td></tr>`).join("");
  return rows || `<tr><td colspan="4" class="muted">Нет строк</td></tr>`;
}

// Pure HTML for the order detail card (escaped). Event wiring stays in admin.js.
export function renderOrderDetail(order, items, attr) {
  const a = (attr && attr[0]) || {};
  return `
    <div class="row" style="justify-content:space-between;">
      <h2 style="margin:0;">${esc(order.customer_name)} · ${esc(order.customer_phone)}</h2>
      <span class="status">${esc(order.status)}</span>
    </div>
    <p class="muted">${esc(when(order.created_at))} · ${esc(order.city)} ${esc(order.region)} ${esc(order.address)}</p>
    ${order.customer_comment ? `<p>Комментарий клиента: ${esc(order.customer_comment)}</p>` : ""}
    <table style="margin:10px 0;"><thead><tr><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead>
      <tbody>${renderItemsRows(items)}</tbody></table>
    <p><strong>Итого: ${esc(money(order.total_kgs))}</strong></p>
    <p class="muted">Источник: utm_source=${esc(a.utm_source)} / utm_campaign=${esc(a.utm_campaign)} / referrer=${esc(a.referrer)} / ручной=${esc(order.customer_source)} / промокод=${esc(order.promo_code)}</p>
    <hr style="border:none;border-top:1px solid var(--line);margin:14px 0;" />
    <div class="row" style="flex-direction:column; align-items:stretch; gap:10px; max-width:520px;">
      <label>Статус
        <select id="editStatus">${renderStatusOptions(order.status)}</select>
      </label>
      <label>Комментарий менеджера
        <textarea id="editComment" rows="3">${esc(order.manager_comment || "")}</textarea>
      </label>
      <div class="row"><button id="saveOrder" type="button">Сохранить</button><span id="saveMsg" class="muted"></span></div>
    </div>`;
}
