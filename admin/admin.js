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
} from "./admin.logic.js";

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle("hidden", !on);

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

async function loadOrders() {
  const body = $("ordersBody");
  body.innerHTML = loadingRowHtml();
  const status = $("statusFilter").value;
  const q = $("search").value;
  let query = supabase
    .from("orders")
    .select("id,created_at,status,total_kgs,customer_name,customer_phone,city,customer_source")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);
  const orFilter = buildSearchOr(q);
  if (orFilter) query = query.or(orFilter);

  let data, error;
  try {
    ({ data, error } = await query);
  } catch (err) {
    error = err;
  }
  const count = $("ordersCount");
  if (error) {
    if (count) count.textContent = "";
    body.innerHTML = `<tr><td colspan="7" class="banner" style="margin:0;">${esc(friendlyError(error))}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    if (count) count.textContent = ordersCountText(0);
    body.innerHTML = `<tr><td colspan="7" class="muted" style="padding:16px;">${esc(emptyOrdersMessage({ status, q }))}</td></tr>`;
    return;
  }
  if (count) count.textContent = ordersCountText(data.length);
  body.innerHTML = data.map(renderOrderRow).join("");
  body.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => openOrder(tr.dataset.id));
  });
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
  $("statusFilter").addEventListener("change", loadOrders);
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
