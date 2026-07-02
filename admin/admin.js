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
  orderSummaryText,
} from "./admin.logic.js";

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle("hidden", !on);

// Orders currently shown in the list — used by the CSV export button.
let lastOrders = [];
// Current page index for pagination (reset to 0 on any filter change).
let page = 0;

const configured = isConfigured({
  url: window.GM_SUPABASE_URL,
  key: window.GM_SUPABASE_ANON_KEY,
  missing: window.__gmConfigMissing,
});

let supabase = null;

function setView(name) {
  show($("loginView"), name === "login");
  show($("accessView"), name === "access");
  show($("listView"), name === "list");
  show($("detailView"), name === "detail");
}

async function refreshSessionUI() {
  const { data } = await supabase.auth.getSession();
  const session = data && data.session;
  $("who").textContent = session ? (session.user.email || "вошли") : "";
  show($("signOut"), Boolean(session));
  const view = nextView(session);
  if (view === "access") {
    $("accessEmail").textContent = session.user.email || "текущий пользователь";
  }
  setView(view);
  if (view === "list") loadOrders();
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
  else { page = 0; lastOrders = []; body.innerHTML = loadingRowHtml(); setMoreButton({ visible: false, busy: false }); }

  const status = $("statusFilter").value;
  const q = $("search").value;
  const period = $("periodFilter") ? $("periodFilter").value : "";
  const [from, to] = pageRange(page, PAGE_SIZE);
  const sort = sortColumn($("sortBy") ? $("sortBy").value : "");
  let query = supabase
    .from("orders")
    .select("id,created_at,status,total_kgs,customer_name,customer_phone,city,customer_source")
    .order(sort.column, { ascending: sort.ascending })
    .range(from, to);
  if (status) query = query.eq("status", status);
  const since = sinceForPeriod(period);
  if (since) query = query.gte("created_at", since);
  const minAmount = parseMinAmount($("minAmount") ? $("minAmount").value : "");
  if (minAmount != null) query = query.gte("total_kgs", minAmount);
  const orFilter = buildSearchOr(q);
  if (orFilter) query = query.or(orFilter);

  let data, error;
  try {
    ({ data, error } = await query);
  } catch (err) {
    error = err;
  }
  const count = $("ordersCount");
  const totalEl = $("ordersTotal");
  if (error) {
    if (!append) lastOrders = [];
    if (count) count.textContent = "";
    if (totalEl) totalEl.textContent = "";
    if (!append) body.innerHTML = `<tr><td colspan="7" class="banner" style="margin:0;">${esc(friendlyError(error))}</td></tr>`;
    setMoreButton({ visible: append, busy: false });
    return;
  }
  const batch = data || [];
  if (!append && batch.length === 0) {
    lastOrders = [];
    if (count) count.textContent = ordersCountText(0);
    if (totalEl) totalEl.textContent = "";
    body.innerHTML = `<tr><td colspan="7" class="muted" style="padding:16px;">${esc(emptyOrdersMessage({ status, q }))}</td></tr>`;
    setMoreButton({ visible: false, busy: false });
    return;
  }
  lastOrders = append ? lastOrders.concat(batch) : batch;
  if (count) count.textContent = ordersCountText(lastOrders.length);
  if (totalEl) totalEl.textContent = ordersTotalText(lastOrders);
  const rowsHtml = lastOrders.map(renderOrderRow).join("");
  body.innerHTML = rowsHtml;
  body.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => openOrder(tr.dataset.id));
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
  refreshSessionUI();
}

init();
