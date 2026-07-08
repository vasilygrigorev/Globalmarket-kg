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

// CSS class per status, so the list/detail "pill" is colour-coded instead of
// uniform grey — a manager scans the list faster when new/cancelled stand out.
// Colours are defined in admin/index.html; unknown statuses fall back to "new".
export const STATUS_CLASSES = {
  new: "status-new",
  contacted: "status-contacted",
  confirmed: "status-confirmed",
  completed: "status-completed",
  cancelled: "status-cancelled",
};

export function statusClass(status) {
  return STATUS_CLASSES[status] || "status-new";
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

// --- Dashboard summary (pure) ---

// Aggregate a raw orders list (each {status, total_kgs, created_at}) into the
// numbers shown in the top summary strip. Independent of list filters/paging —
// admin.js feeds it a dedicated lightweight query of all orders. `now` is
// injectable for tests. Cancelled orders are excluded from revenue (they didn't
// earn anything) but still counted per status so the breakdown stays honest.
export function computeDashboardStats(orders, now = new Date()) {
  const list = (orders || []).filter(Boolean);
  const dayStart = new Date(now.getTime());
  dayStart.setHours(0, 0, 0, 0);
  const startMs = dayStart.getTime();
  const byStatus = { new: 0, contacted: 0, confirmed: 0, completed: 0, cancelled: 0 };
  let todayCount = 0;
  let todayRevenue = 0;
  let openRevenue = 0; // revenue of non-cancelled orders
  for (const o of list) {
    const total = Number(o.total_kgs) || 0;
    const status = o.status;
    if (byStatus[status] != null) byStatus[status] += 1;
    if (status !== "cancelled") openRevenue += total;
    const t = new Date(o.created_at).getTime();
    if (Number.isFinite(t) && t >= startMs) {
      todayCount += 1;
      if (status !== "cancelled") todayRevenue += total;
    }
  }
  return {
    total: list.length,
    byStatus,
    newCount: byStatus.new,
    todayCount,
    todayRevenue,
    openRevenue,
  };
}

// Render the summary strip HTML from computeDashboardStats() output (pure).
// A few headline chips (today's orders + revenue, new/unprocessed, all-time)
// plus a compact per-status breakdown line. Returns "" for absent stats so the
// strip can be blanked while loading.
export function renderDashboard(stats) {
  if (!stats) return "";
  const s = stats;
  const chip = (value, label, cls = "") =>
    `<div class="stat ${cls}"><span class="stat-value">${esc(value)}</span><span class="stat-label">${esc(label)}</span></div>`;
  const headline = [
    chip(s.todayCount, "заказов сегодня"),
    chip(money(s.todayRevenue), "выручка сегодня"),
    chip(s.newCount, "новых, ждут обработки", s.newCount > 0 ? "stat-alert" : ""),
    chip(s.total, "всего заказов"),
    chip(money(s.openRevenue), "сумма (без отменённых)"),
  ].join("");
  const by = s.byStatus || {};
  const breakdown = STATUSES
    .map((st) => `<span class="stat-pill ${statusClass(st)}">${esc(statusLabel(st))}: ${esc(by[st] || 0)}</span>`)
    .join("");
  return `<div class="stats-row">${headline}</div><div class="stats-breakdown">${breakdown}</div>`;
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

// tel: link to call the customer (keeps a leading +; "" when no digits).
export function customerTelLink(phone) {
  const raw = String(phone || "");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return `tel:${raw.trim().startsWith("+") ? "+" : ""}${digits}`;
}

// WhatsApp link that opens a chat with the customer AND pre-fills a message
// (digits only; "" when no phone). When `text` is empty it degrades to a plain
// wa.me chat link. The body is URL-encoded so line breaks/Cyrillic survive.
export function customerWaTextLink(phone, text) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const body = String(text || "");
  return `https://wa.me/${digits}${body ? `?text=${encodeURIComponent(body)}` : ""}`;
}

// Customer-facing order confirmation message (plain text, RU) a manager can send
// straight to the customer over WhatsApp. Unlike orderSummaryText (internal
// manager view), this greets the customer and asks them to confirm. Skips any
// part that is absent so it never shows empty fields.
export function orderConfirmationText(order, items) {
  const o = order || {};
  const lines = [];
  lines.push(`Здравствуйте${o.customer_name ? `, ${o.customer_name}` : ""}! Это Global Market KG.`);
  lines.push("Спасибо за заказ! Проверьте, пожалуйста, детали:");
  const rows = (items || []).filter(Boolean);
  if (rows.length) {
    lines.push("—");
    for (const it of rows) {
      const qty = Number(it.qty) || 0;
      lines.push(`${qty}× ${it.title_snapshot || ""} — ${money(it.line_total_kgs)}`);
    }
  }
  lines.push("—");
  lines.push(`Итого: ${money(o.total_kgs)}`);
  const address = orderAddressText(o);
  if (address) lines.push(`Доставка: ${address}`);
  lines.push("Подтвердите, пожалуйста, заказ и удобное время доставки. Спасибо!");
  return lines.join("\n");
}

// Russian plural for "заказ" (pure): 1 заказ, 2 заказа, 5 заказов.
export function pluralOrders(n) {
  const count = Number(n) || 0;
  const d = count % 10;
  const dd = count % 100;
  if (d === 1 && dd !== 11) return "заказ";
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "заказа";
  return "заказов";
}

// "Показано N заказов" — how many rows are currently loaded (pure).
export function ordersCountText(n) {
  const count = Number(n) || 0;
  return `Показано ${count} ${pluralOrders(count)}`;
}

// "Всего N заказов" from the server-side exact match count (pure).
// `total` is the count of ALL orders matching the current filter, not just the
// loaded page, so the manager sees the real size of the result set even while
// paginating. Returns "" when the count is unknown (null/undefined).
export function ordersMatchingText(total) {
  if (total == null) return "";
  const n = Number(total) || 0;
  return `Всего ${n} ${pluralOrders(n)}`;
}

// --- Amount filter (pure) ---

// Parse a positive number out of an amount-filter input, or null when the
// field is empty/invalid (so no filter is applied). Accepts comma decimals and
// strips spaces/currency, so "1 500 сом" -> 1500. Shared by min/max amount.
function parsePositiveAmount(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/\s/g, "").replace(",", ".");
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseMinAmount(value) {
  return parsePositiveAmount(value);
}

export function parseMaxAmount(value) {
  return parsePositiveAmount(value);
}

// --- Sorting (pure) ---

// Allowed sort options for the orders list: select value -> server order spec.
// Only whitelisted columns are accepted, so the value can't inject an arbitrary
// column into the PostgREST .order() call.
export const SORT_OPTIONS = {
  created_desc: { column: "created_at", ascending: false },
  created_asc: { column: "created_at", ascending: true },
  total_desc: { column: "total_kgs", ascending: false },
  total_asc: { column: "total_kgs", ascending: true },
  name_asc: { column: "customer_name", ascending: true },
  name_desc: { column: "customer_name", ascending: false },
};

export const DEFAULT_SORT = "created_desc";

// Resolve a select value to a safe { column, ascending } spec (pure).
// Unknown/empty values fall back to the default (newest first).
export function sortColumn(value) {
  return SORT_OPTIONS[value] || SORT_OPTIONS[DEFAULT_SORT];
}

// --- Pagination (pure) ---

// How many orders to fetch per page.
export const PAGE_SIZE = 50;

// Inclusive [from, to] range for a PostgREST .range() call (0-based page).
export function pageRange(page, size = PAGE_SIZE) {
  const p = Math.max(0, Math.floor(Number(page) || 0));
  const s = Math.max(1, Math.floor(Number(size) || PAGE_SIZE));
  const from = p * s;
  return [from, from + s - 1];
}

// A page is "full" when it returned exactly `size` rows, so more may exist.
export function hasMore(batchCount, size = PAGE_SIZE) {
  return (Number(batchCount) || 0) >= Math.max(1, Math.floor(Number(size) || PAGE_SIZE));
}

// Label for the "load more" button, depending on in-flight state (pure).
export function moreButtonText(busy) {
  return busy ? "Загрузка…" : "Показать ещё";
}

// --- CSV export of the shown orders (pure; admin.js feeds it the loaded rows) ---

// Columns exported, in order: [object key, header label].
export const CSV_COLUMNS = [
  ["created_at", "Дата"],
  ["customer_name", "Клиент"],
  ["customer_phone", "Телефон"],
  ["city", "Город"],
  ["total_kgs", "Сумма (сом)"],
  ["status", "Статус"],
  ["customer_source", "Источник"],
];

// Quote one CSV field per RFC 4180: wrap in quotes when it contains a comma,
// quote, or newline; double any inner quotes. A leading =,+,-,@ is prefixed
// with a single quote to defuse spreadsheet formula injection.
export function csvField(value) {
  let s = String(value ?? "");
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Build a CSV string from the orders currently shown. Dates become a readable
// local string, status becomes its Russian label, total is a plain number.
// Returns a header-only CSV when there are no orders. Includes a UTF-8 BOM so
// Excel opens Cyrillic correctly.
export function ordersToCsv(orders) {
  const header = CSV_COLUMNS.map(([, label]) => csvField(label)).join(",");
  const rows = (orders || []).map((o) =>
    CSV_COLUMNS.map(([key]) => {
      if (key === "created_at") return csvField(when(o[key]));
      if (key === "status") return csvField(statusLabel(o[key]));
      if (key === "total_kgs") return csvField(Math.round(Number(o[key]) || 0));
      return csvField(o[key]);
    }).join(",")
  );
  return "﻿" + [header, ...rows].join("\r\n") + "\r\n";
}

// Timestamped export filename, e.g. orders-2026-06-29.csv (pure).
export function csvFilename(now = new Date()) {
  const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `orders-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
}

// --- Order summary for the manager (plain text, WhatsApp-readable; pure) ---

// Joined delivery address (city, region, street), or "" when none given (pure).
// Shared by the summary text and the order-detail card so both agree on format.
export function orderAddressText(order) {
  const o = order || {};
  return [o.city, o.region, o.address].filter(Boolean).join(", ");
}

// Build a clean, copy-pasteable order summary a manager can paste into WhatsApp.
// Plain text only (no HTML): customer, phone, delivery address, item lines,
// total, status, source, and comments — skipping any parts that are absent.
export function orderSummaryText(order, items) {
  const o = order || {};
  const lines = [];
  lines.push(`Заказ${o.created_at ? ` · ${when(o.created_at)}` : ""}`);
  if (o.customer_name) lines.push(`Клиент: ${o.customer_name}`);
  if (o.customer_phone) lines.push(`Телефон: ${o.customer_phone}`);
  const address = orderAddressText(o);
  if (address) lines.push(`Адрес: ${address}`);
  const rows = (items || []).filter(Boolean);
  if (rows.length) {
    lines.push("—");
    for (const it of rows) {
      const qty = Number(it.qty) || 0;
      lines.push(`${qty}× ${it.title_snapshot || ""} — ${money(it.line_total_kgs)}`);
    }
  }
  lines.push("—");
  const itemsLine = orderItemsSummary(rows);
  if (itemsLine) lines.push(itemsLine);
  lines.push(`Итого: ${money(o.total_kgs)}`);
  lines.push(`Статус: ${statusLabel(o.status)}`);
  if (o.customer_source) lines.push(`Источник: ${o.customer_source}`);
  if (o.promo_code) lines.push(`Промокод: ${o.promo_code}`);
  if (o.customer_comment) lines.push(`Комментарий клиента: ${o.customer_comment}`);
  if (o.manager_comment) lines.push(`Комментарий менеджера: ${o.manager_comment}`);
  return lines.join("\n");
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

// Inline status <select> shown in each list row, so a manager can change an
// order's status without opening it (change handler wired in admin.js). Carries
// the order id + a status colour class; admin.js swaps the class on change.
export function renderRowStatusSelect(o) {
  const opts = STATUSES
    .map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${esc(statusLabel(s))}</option>`)
    .join("");
  return `<select class="row-status ${statusClass(o.status)}" data-id="${esc(o.id)}" aria-label="Сменить статус заказа" title="Сменить статус">${opts}</select>`;
}

export function renderOrderRow(o) {
  // Rows are keyboard-operable: focusable, announced as a button, and opened
  // with Enter/Space (handler wired in admin.js). The label gives screen-reader
  // users the key facts without opening the order.
  const label = `Открыть заказ: ${statusLabel(o.status)}, ${o.customer_name || "без имени"}, ${money(o.total_kgs)}`;
  // New (unprocessed) orders get a highlight so they stand out in the list.
  const rowClass = o.status === "new" ? "row-new" : "";
  return `
    <tr data-id="${esc(o.id)}" class="${rowClass}" tabindex="0" role="button" aria-label="${esc(label)}" style="cursor:pointer;">
      <td>${esc(when(o.created_at))}</td>
      <td>${esc(o.customer_name)}</td>
      <td>${esc(o.customer_phone)}</td>
      <td>${esc(o.city)}</td>
      <td>${esc(money(o.total_kgs))}</td>
      <td>${renderRowStatusSelect(o)}</td>
      <td>${esc(o.customer_source)}</td>
    </tr>`;
}

// --- Auto-refresh (pure) ---

// How often the list auto-refreshes, in ms.
export const AUTO_REFRESH_MS = 30000;

// Whether an auto-refresh tick should actually reload now. Only when: the toggle
// is on, the list view is showing (never mid-edit in a detail), the tab is
// visible (no pointless polling in a background tab), and we're on the first
// page (don't yank a manager who paged through results back to the top). Pure.
export function shouldAutoRefresh({ enabled, view, hidden, page } = {}) {
  return Boolean(enabled) && view === "list" && !hidden && (Number(page) || 0) === 0;
}

// Which view to show given the current auth session. Pure (no DOM).
export function nextView(session) {
  if (!session) return "login";
  if (!isAdminSession(session)) return "access";
  return "list";
}

// "N позиций · M шт" summary for an order's items, with correct Russian plural
// for "позиция" (pure). Returns "" for an empty/absent list.
export function orderItemsSummary(items) {
  const rows = (items || []).filter(Boolean);
  if (!rows.length) return "";
  const positions = rows.length;
  const qty = rows.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const d = positions % 10;
  const dd = positions % 100;
  let word = "позиций";
  if (d === 1 && dd !== 11) word = "позиция";
  else if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) word = "позиции";
  return `${positions} ${word} · ${qty} шт`;
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
  const addressText = orderAddressText(order);
  const address = addressText || "—";
  return `
    <div class="row" style="justify-content:space-between;">
      <h2 style="margin:0;">${esc(order.customer_name)} · ${esc(order.customer_phone)}</h2>
      <span class="status ${statusClass(order.status)}">${esc(statusLabel(order.status))}</span>
    </div>
    <p class="muted">${esc(when(order.created_at))}</p>
    ${customerWaLink(order.customer_phone)
      ? `<p class="row" style="gap:14px;">
          <a href="${esc(customerWaLink(order.customer_phone))}" target="_blank" rel="noopener">Написать клиенту в WhatsApp</a>
          <a href="${esc(customerWaTextLink(order.customer_phone, orderConfirmationText(order, items)))}" target="_blank" rel="noopener">Отправить подтверждение заказа</a>
          <a href="${esc(customerTelLink(order.customer_phone))}">Позвонить</a>
          <button id="copyPhone" type="button" class="secondary">Копировать телефон</button>
        </p>`
      : ""}
    <table style="margin:10px 0;"><thead><tr><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead>
      <tbody>${renderItemsRows(items)}</tbody></table>
    ${orderItemsSummary(items) ? `<p class="muted" style="margin:2px 0;">${esc(orderItemsSummary(items))}</p>` : ""}
    <p><strong>Итого: ${esc(money(order.total_kgs))}</strong></p>
    <dl class="order-facts" style="display:grid; grid-template-columns:auto 1fr; gap:4px 12px; margin:10px 0;">
      <dt class="muted">Адрес</dt><dd>${esc(address)}${addressText
        ? ` <button id="copyAddress" type="button" class="secondary" style="min-height:26px; padding:0 10px; font-size:12px; vertical-align:middle;">Копировать</button>`
        : ""}</dd>
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
      <div class="row">
        <button id="saveOrder" type="button">Сохранить</button>
        <button id="copySummary" type="button" class="secondary">Копировать сводку</button>
        <span id="saveMsg" class="muted"></span>
        <span id="copyMsg" class="muted"></span>
      </div>
    </div>`;
}

// --- Wholesale applications ("Подать заявку на оптовый доступ") ---
// See supabase/migrations/0004_customer_roles_wholesale.sql,
// functions/api/wholesale-application.js. Pending applications only — once
// approved/rejected they drop out of this queue (the manager already acted).

export function renderWholesaleApplicationRow(app) {
  return `
    <tr data-id="${esc(app.id)}">
      <td>${esc(when(app.created_at))}</td>
      <td>${esc(app.name)}</td>
      <td>${esc(app.phone)}</td>
      <td>${esc(app.shop_name)}</td>
      <td>${esc(app.city)}</td>
      <td>${esc(app.comment)}</td>
      <td>
        <button class="secondary wholesale-approve" type="button" data-id="${esc(app.id)}" data-customer-id="${esc(app.customer_id || "")}">Подтвердить</button>
        <button class="secondary wholesale-reject" type="button" data-id="${esc(app.id)}" data-customer-id="${esc(app.customer_id || "")}">Отклонить</button>
      </td>
    </tr>`;
}

export function wholesaleApplicationsEmptyRow() {
  return `<tr><td colspan="7" class="muted" style="padding:16px;">Нет новых заявок на оптовый доступ.</td></tr>`;
}

export function wholesaleApplicationsCountText(n) {
  const count = Number(n) || 0;
  return count > 0 ? `Заявок на рассмотрении: ${count}` : "";
}
