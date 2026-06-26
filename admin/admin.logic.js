// Pure, dependency-free helpers for the admin orders page.
// No DOM, no network, no Supabase import — so it is unit-testable in Node.
// admin.js imports these; admin.logic.test.mjs tests them.

export const STATUSES = ["new", "contacted", "confirmed", "completed", "cancelled"];

// Russian labels for order statuses (values stay English to match the DB CHECK).
export const STATUS_LABELS = {
  new: "Новый",
  contacted: "Связались",
  confirmed: "Подтверждён",
  completed: "Выполнен",
  cancelled: "Отменён",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "";
}

// ISO timestamp for a list date filter, or null for "all" (pure).
// period: "today" | "7d" | "30d" | "" (all).
export function sinceForPeriod(period, now = new Date()) {
  const d = new Date(now.getTime());
  if (period === "today") {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (period === "7d") {
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  if (period === "30d") {
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }
  return null;
}

// Sum of the currently shown orders (pure).
export function ordersTotalText(orders) {
  const sum = (orders || []).reduce((s, o) => s + (Number(o.total_kgs) || 0), 0);
  return `Сумма показанных: ${money(sum)}`;
}

// Marketing consent summary from a customer_consents list (pure).
export function consentText(consents) {
  const list = consents || [];
  if (!list.length) return "—";
  return list.some((c) => c && c.is_granted) ? "да" : "нет";
}

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

// WhatsApp link to contact the CUSTOMER from the admin (digits only; "" if none).
export function customerWaLink(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

// "Показано N заказов" with correct Russian plural (pure).
export function ordersCountText(n) {
  const count = Number(n) || 0;
  const d = count % 10;
  const dd = count % 100;
  let word = "заказов";
  if (d === 1 && dd !== 11) word = "заказ";
  else if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) word = "заказа";
  return `Показано ${count} ${word}`;
}

export const LOADING_ROW_TEXT = "Загрузка…";

// Loading placeholder row for the orders table (pure).
export function loadingRowHtml(colspan = 7) {
  return `<tr><td colspan="${colspan}" class="muted" style="padding:16px;">${LOADING_ROW_TEXT}</td></tr>`;
}

// Login submit button label depending on in-flight state (pure).
export function loginButtonLabel(busy) {
  return busy ? "Входим…" : "Войти";
}

// Save-status feedback for the order detail. state: "saving" | "done" | "error".
// Returns { text, ok } — `ok` drives a green success style.
export function saveFeedback(state, error) {
  if (state === "saving") return { text: "Сохранение…", ok: false };
  if (state === "done") return { text: "Сохранено ✓", ok: true };
  return { text: friendlyError(error) || "Не удалось сохранить.", ok: false };
}

export function renderStatusOptions(current) {
  return STATUSES
    .map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${esc(statusLabel(s))}</option>`)
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
      <td><span class="status">${esc(statusLabel(o.status))}</span></td>
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

// Source/attribution one-liner (pure). Shows only the parts that are present.
export function sourceText(order, attr) {
  const a = (attr && attr[0]) || {};
  const parts = [];
  if (a.utm_source) parts.push(`utm_source=${a.utm_source}`);
  if (a.utm_campaign) parts.push(`utm_campaign=${a.utm_campaign}`);
  if (a.utm_content) parts.push(`utm_content=${a.utm_content}`);
  if (a.referrer) parts.push(`referrer=${a.referrer}`);
  if (order.customer_source) parts.push(`ручной=${order.customer_source}`);
  return parts.length ? parts.join(" / ") : "не указан";
}

// Pure HTML for the order detail card (escaped). Event wiring stays in admin.js.
export function renderOrderDetail(order, items, attr, consents) {
  const address = [order.city, order.region, order.address].filter(Boolean).join(", ") || "—";
  return `
    <div class="row" style="justify-content:space-between;">
      <h2 style="margin:0;">${esc(order.customer_name)} · ${esc(order.customer_phone)}</h2>
      <span class="status">${esc(statusLabel(order.status))}</span>
    </div>
    <p class="muted">${esc(when(order.created_at))}</p>
    ${customerWaLink(order.customer_phone)
      ? `<p><a href="${esc(customerWaLink(order.customer_phone))}" target="_blank" rel="noopener">Написать клиенту в WhatsApp</a></p>`
      : ""}
    <table style="margin:10px 0;"><thead><tr><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead>
      <tbody>${renderItemsRows(items)}</tbody></table>
    <p><strong>Итого: ${esc(money(order.total_kgs))}</strong></p>
    <dl class="order-facts" style="display:grid; grid-template-columns:auto 1fr; gap:4px 12px; margin:10px 0;">
      <dt class="muted">Адрес</dt><dd>${esc(address)}</dd>
      <dt class="muted">Комментарий клиента</dt><dd>${esc(order.customer_comment || "—")}</dd>
      <dt class="muted">Источник рекламы</dt><dd>${esc(sourceText(order, attr))}</dd>
      <dt class="muted">Промокод</dt><dd>${esc(order.promo_code || "—")}</dd>
      <dt class="muted">Согласие на акции</dt><dd>${esc(consentText(consents))}</dd>
    </dl>
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
