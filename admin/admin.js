// Admin orders page logic. Uses Supabase JS (anon key) + an authenticated admin
// session. RLS (public.is_admin()) does the real access control — see
// docs/admin-orders-spec.md. No service-role key is used here.
//
// Pure, testable helpers live in admin.logic.js (admin.logic.test.mjs).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  esc,
  isConfigured,
  buildSearchOr,
  friendlyError,
  emptyOrdersMessage,
  renderOrderRow,
  ordersMatchingText,
  nextView,
  renderOrderDetail,
  loadingRowHtml,
  loginButtonLabel,
  saveFeedback,
  ordersCountText,
  ordersTotalText,
  sinceForPeriod,
  ordersToCsv,
  csvFilename,
  PAGE_SIZE,
  pageRange,
  hasMore,
  moreButtonText,
  sortColumn,
  parseMinAmount,
  parseMaxAmount,
  orderSummaryText,
  orderAddressText,
  computeDashboardStats,
  renderDashboard,
  shouldAutoRefresh,
  AUTO_REFRESH_MS,
  statusClass,
  statusLabel,
} from "./admin.logic.js";

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle("hidden", !on);

// Orders currently shown in the list — used by the CSV export button.
let lastOrders = [];
// Current page index for pagination (reset to 0 on any filter change).
let page = 0;
// Which view is currently shown — read by the auto-refresh tick so it only
// reloads while the list is open (never mid-edit in an order detail).
let currentView = "login";

const configured = isConfigured({
  url: window.GM_SUPABASE_URL,
  key: window.GM_SUPABASE_ANON_KEY,
  missing: window.__gmConfigMissing,
});

let supabase = null;

function setView(name) {
  currentView = name;
  show($("loginView"), name === "login");
  show($("accessView"), name === "access");
  show($("listView"), name === "list");
  show($("detailView"), name === "detail");
}

// Transient message next to the orders count (quick status change feedback).
function setListMsg(text, ok) {
  const el = $("listMsg");
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("ok", Boolean(ok));
}

// Load the top summary strip. Uses a dedicated lightweight query of all orders
// (status/total/date only) so the numbers reflect the whole table, independent
// of the list's filters and pagination. Fails quietly (blanks the strip) — the
// dashboard is a convenience, never a blocker for the list itself.
async function loadStats() {
  const box = $("dashboard");
  if (!box) return;
  let data, error;
  try {
    ({ data, error } = await supabase.from("orders").select("status,total_kgs,created_at"));
  } catch (err) {
    error = err;
  }
  if (error || !data) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = renderDashboard(computeDashboardStats(data));
}

// Recolour a row's inline status control + its new-order highlight after a change.
function applyRowStatusUI(sel, status) {
  sel.className = `row-status ${statusClass(status)}`;
  const tr = sel.closest("tr");
  if (tr) tr.classList.toggle("row-new", status === "new");
}

// Change an order's status straight from the list, without opening it. On error
// the select reverts to the previous value so the row never lies about state.
async function quickUpdateStatus(id, status, sel) {
  const o = lastOrders.find((x) => String(x.id) === String(id));
  const prevStatus = o ? o.status : null;
  sel.disabled = true;
  setListMsg("Сохранение…", false);
  let error;
  try {
    ({ error } = await supabase.from("orders").update({ status }).eq("id", id));
  } catch (err) {
    error = err;
  }
  sel.disabled = false;
  if (error) {
    if (prevStatus != null) sel.value = prevStatus;
    setListMsg(friendlyError(error) || "Не удалось сменить статус", false);
    return;
  }
  if (o) o.status = status;
  applyRowStatusUI(sel, status);
  setListMsg(`Статус: ${statusLabel(status)} ✓`, true);
  loadStats();
}

async function refreshSessionUI() {
  let session = null;
  try {
    const { data } = await supabase.auth.getSession();
    session = data && data.session;
  } catch (err) {
    // Network/SDK failure while reading the session: fail safe to the login
    // view with a clear message instead of a blank screen. RLS still protects
    // the data regardless of what the client shows.
    setView("login");
    const box = $("loginError");
    if (box) { box.textContent = friendlyError(err); show(box, true); }
    return;
  }
  $("who").textContent = session ? (session.user.email || "вошли") : "";
  show($("signOut"), Boolean(session));
  const view = nextView(session);
  if (view === "access") {
    $("accessEmail").textContent = session.user.email || "текущий пользователь";
  }
  setView(view);
  if (view === "list") { loadOrders(); loadStats(); }
}

function setMoreButton({ visible, busy }) {
  const btn = $("loadMore");
  if (!btn) return;
  show(btn, visible);
  btn.disabled = Boolean(busy);
  btn.textContent = moreButtonText(busy);
}

async function loadOrders({ append = false } = {}) {
  const body = $("ordersBody");
  if (append) { page += 1; setMoreButton({ visible: true, busy: true }); }
  else { page = 0; lastOrders = []; setListMsg(""); body.innerHTML = loadingRowHtml(); setMoreButton({ visible: false, busy: false }); }

  const status = $("statusFilter").value;
  const q = $("search").value;
  const period = $("periodFilter") ? $("periodFilter").value : "";
  const [from, to] = pageRange(page, PAGE_SIZE);
  const sort = sortColumn($("sortBy") ? $("sortBy").value : "");
  let query = supabase
    .from("orders")
    .select("id,created_at,status,total_kgs,customer_name,customer_phone,city,customer_source", { count: "exact" })
    .order(sort.column, { ascending: sort.ascending })
    .range(from, to);
  if (status) query = query.eq("status", status);
  const since = sinceForPeriod(period);
  if (since) query = query.gte("created_at", since);
  const minAmount = parseMinAmount($("minAmount") ? $("minAmount").value : "");
  if (minAmount != null) query = query.gte("total_kgs", minAmount);
  const maxAmount = parseMaxAmount($("maxAmount") ? $("maxAmount").value : "");
  if (maxAmount != null) query = query.lte("total_kgs", maxAmount);
  const orFilter = buildSearchOr(q);
  if (orFilter) query = query.or(orFilter);

  let data, error, matchCount;
  try {
    ({ data, error, count: matchCount } = await query);
  } catch (err) {
    error = err;
  }
  const countEl = $("ordersCount");
  const totalEl = $("ordersTotal");
  if (error) {
    if (!append) lastOrders = [];
    if (countEl) countEl.textContent = "";
    if (totalEl) totalEl.textContent = "";
    if (!append) body.innerHTML = `<tr><td colspan="7" class="banner" style="margin:0;">${esc(friendlyError(error))}</td></tr>`;
    setMoreButton({ visible: append, busy: false });
    return;
  }
  const batch = data || [];
  // Server-side exact count of ALL orders matching the filter (independent of
  // pagination); fall back to the loaded count if the server omits it.
  const setCount = (loaded) => {
    if (countEl) countEl.textContent = ordersMatchingText(matchCount) || ordersCountText(loaded);
  };
  if (!append && batch.length === 0) {
    lastOrders = [];
    setCount(0);
    if (totalEl) totalEl.textContent = "";
    body.innerHTML = `<tr><td colspan="7" class="muted" style="padding:16px;">${esc(emptyOrdersMessage({ status, q }))}</td></tr>`;
    setMoreButton({ visible: false, busy: false });
    return;
  }
  lastOrders = append ? lastOrders.concat(batch) : batch;
  setCount(lastOrders.length);
  if (totalEl) totalEl.textContent = ordersTotalText(lastOrders);
  const rowsHtml = lastOrders.map(renderOrderRow).join("");
  body.innerHTML = rowsHtml;
  body.querySelectorAll("tr[data-id]").forEach((tr) => {
    const open = () => openOrder(tr.dataset.id);
    tr.addEventListener("click", open);
    // Keyboard access: Enter/Space open the focused row like a click.
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
    // Inline status changer: interacting with it must NOT open the order.
    const sel = tr.querySelector("select.row-status");
    if (sel) {
      const stop = (e) => e.stopPropagation();
      sel.addEventListener("click", stop);
      sel.addEventListener("keydown", stop);
      sel.addEventListener("change", (e) => { stop(e); quickUpdateStatus(sel.dataset.id, sel.value, sel); });
    }
  });
  setMoreButton({ visible: hasMore(batch.length, PAGE_SIZE), busy: false });
}

async function openOrder(id) {
  setView("detail");
  const box = $("detailBody");
  box.innerHTML = `<p class="muted">Загрузка…</p>`;
  let order; let items; let attr; let consents; let e1;
  try {
    [{ data: order, error: e1 }, { data: items }, { data: attr }, { data: consents }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase.from("order_items").select("*").eq("order_id", id),
      supabase.from("marketing_attribution").select("*").eq("order_id", id),
      supabase.from("customer_consents").select("*").eq("order_id", id),
    ]);
  } catch (err) {
    e1 = err;
  }
  if (e1 || !order) {
    box.innerHTML = `<p class="banner" style="margin:0;">${esc(friendlyError(e1) || "Не удалось загрузить заказ.")}</p>`;
    return;
  }
  box.innerHTML = renderOrderDetail(order, items, attr, consents);
  $("saveOrder").addEventListener("click", () => saveOrder(id));
  $("copySummary").addEventListener("click", () => copyOrderSummary(order, items));
  const phoneBtn = $("copyPhone");
  if (phoneBtn) phoneBtn.addEventListener("click", () => copyToClipboard(order.customer_phone, "Телефон скопирован ✓"));
  const addressBtn = $("copyAddress");
  if (addressBtn) addressBtn.addEventListener("click", () => copyToClipboard(orderAddressText(order), "Адрес скопирован ✓"));
}

async function copyToClipboard(text, okText) {
  const msg = $("copyMsg");
  try {
    await navigator.clipboard.writeText(String(text || ""));
    if (msg) { msg.textContent = okText; msg.classList.add("ok"); }
  } catch {
    if (msg) { msg.textContent = "Не удалось скопировать"; msg.classList.remove("ok"); }
  }
}

async function copyOrderSummary(order, items) {
  const msg = $("copyMsg");
  const text = orderSummaryText(order, items);
  try {
    await navigator.clipboard.writeText(text);
    if (msg) { msg.textContent = "Скопировано ✓"; msg.classList.add("ok"); }
  } catch {
    if (msg) { msg.textContent = "Не удалось скопировать"; msg.classList.remove("ok"); }
  }
}

function resetFilters() {
  $("statusFilter").value = "";
  if ($("periodFilter")) $("periodFilter").value = "";
  if ($("sortBy")) $("sortBy").value = "created_desc";
  if ($("minAmount")) $("minAmount").value = "";
  if ($("maxAmount")) $("maxAmount").value = "";
  $("search").value = "";
  loadOrders();
}

function exportOrdersCsv() {
  if (!lastOrders.length) return;
  const csv = ordersToCsv(lastOrders);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = csvFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setSaveMsg(msg, state, error) {
  const fb = saveFeedback(state, error);
  msg.textContent = fb.text;
  msg.classList.toggle("ok", fb.ok);
}

async function saveOrder(id) {
  const msg = $("saveMsg");
  const btn = $("saveOrder");
  setSaveMsg(msg, "saving");
  if (btn) btn.disabled = true;
  let error;
  try {
    ({ error } = await supabase
      .from("orders")
      .update({ status: $("editStatus").value, manager_comment: $("editComment").value })
      .eq("id", id));
  } catch (err) {
    error = err;
  }
  if (btn) btn.disabled = false;
  setSaveMsg(msg, error ? "error" : "done", error);
  // A saved status change shifts the summary numbers — refresh them.
  if (!error) loadStats();
}

function wire() {
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("loginError");
    const btn = e.currentTarget.querySelector("button[type='submit']");
    show(err, false);
    if (btn) { btn.disabled = true; btn.textContent = loginButtonLabel(true); }
    let error;
    try {
      ({ error } = await supabase.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value,
      }));
    } catch (ex) {
      error = ex;
    }
    if (btn) { btn.disabled = false; btn.textContent = loginButtonLabel(false); }
    if (error) { err.textContent = friendlyError(error); show(err, true); return; }
    refreshSessionUI();
  });
  $("signOut").addEventListener("click", async () => { await supabase.auth.signOut(); refreshSessionUI(); });
  $("refresh").addEventListener("click", loadOrders);
  $("resetFilters").addEventListener("click", resetFilters);
  $("exportCsv").addEventListener("click", exportOrdersCsv);
  $("loadMore").addEventListener("click", () => loadOrders({ append: true }));
  $("statusFilter").addEventListener("change", loadOrders);
  $("periodFilter")?.addEventListener("change", loadOrders);
  $("sortBy")?.addEventListener("change", loadOrders);
  $("minAmount")?.addEventListener("keydown", (e) => { if (e.key === "Enter") loadOrders(); });
  $("maxAmount")?.addEventListener("keydown", (e) => { if (e.key === "Enter") loadOrders(); });
  $("search").addEventListener("keydown", (e) => { if (e.key === "Enter") loadOrders(); });
  $("backToList").addEventListener("click", (e) => { e.preventDefault(); setView("list"); loadOrders(); });
}

function init() {
  if (!configured) {
    show($("notConfigured"), true);
    return;
  }
  supabase = createClient(window.GM_SUPABASE_URL, window.GM_SUPABASE_ANON_KEY);
  wire();
  // Keep the view in sync when the session changes outside our control: a failed
  // token refresh, expiry, or a sign-out in another tab routes back to login
  // instead of leaving a dead screen. The INITIAL_SESSION event is skipped —
  // the explicit refreshSessionUI() below handles first render (no double load).
  supabase.auth.onAuthStateChange((event) => {
    if (event === "INITIAL_SESSION") return;
    refreshSessionUI();
  });
  // Auto-refresh: quietly pull new orders + refresh the summary while the list
  // is open and the tab is visible. shouldAutoRefresh() keeps it from disrupting
  // an open order detail or a manager who has paged past the first page.
  setInterval(() => {
    const enabled = $("autoRefresh") ? $("autoRefresh").checked : false;
    if (shouldAutoRefresh({ enabled, view: currentView, hidden: document.hidden, page })) {
      loadOrders();
      loadStats();
    }
  }, AUTO_REFRESH_MS);
  refreshSessionUI();
}

init();
