// Admin orders page logic. Uses Supabase JS (anon key) + an authenticated admin
// session. RLS (public.is_admin()) does the real access control — see
// docs/admin-orders-spec.md. No service-role key is used here.
//
// Pure, testable helpers live in admin.logic.js (admin.logic.test.mjs).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  STATUSES,
  esc,
  money,
  when,
  isConfigured,
  isAdminSession,
  buildSearchOr,
  friendlyError,
  emptyOrdersMessage,
  renderStatusOptions,
  renderOrderRow,
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
  if (!session) {
    setView("login");
    return;
  }
  if (!isAdminSession(session)) {
    $("accessEmail").textContent = session.user.email || "текущий пользователь";
    setView("access");
    return;
  }
  setView("list");
  loadOrders();
}

async function loadOrders() {
  const body = $("ordersBody");
  body.innerHTML = `<tr><td colspan="7" class="muted" style="padding:16px;">Загрузка…</td></tr>`;
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
  if (error) {
    body.innerHTML = `<tr><td colspan="7" class="banner" style="margin:0;">${esc(friendlyError(error))}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="muted" style="padding:16px;">${esc(emptyOrdersMessage({ status, q }))}</td></tr>`;
    return;
  }
  body.innerHTML = data.map(renderOrderRow).join("");
  body.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => openOrder(tr.dataset.id));
  });
}

async function openOrder(id) {
  setView("detail");
  const box = $("detailBody");
  box.innerHTML = `<p class="muted">Загрузка…</p>`;
  let order; let items; let attr; let e1;
  try {
    [{ data: order, error: e1 }, { data: items }, { data: attr }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase.from("order_items").select("*").eq("order_id", id),
      supabase.from("marketing_attribution").select("*").eq("order_id", id),
    ]);
  } catch (err) {
    e1 = err;
  }
  if (e1 || !order) {
    box.innerHTML = `<p class="banner" style="margin:0;">${esc(friendlyError(e1) || "Не удалось загрузить заказ.")}</p>`;
    return;
  }
  const a = (attr && attr[0]) || {};
  const itemRows = (items || []).map((it) => `
    <tr><td>${esc(it.title_snapshot)}</td><td>${esc(it.qty)}</td>
    <td>${esc(money(it.price_kgs))}</td><td>${esc(money(it.line_total_kgs))}</td></tr>`).join("");
  box.innerHTML = `
    <div class="row" style="justify-content:space-between;">
      <h2 style="margin:0;">${esc(order.customer_name)} · ${esc(order.customer_phone)}</h2>
      <span class="status">${esc(order.status)}</span>
    </div>
    <p class="muted">${esc(when(order.created_at))} · ${esc(order.city)} ${esc(order.region)} ${esc(order.address)}</p>
    ${order.customer_comment ? `<p>Комментарий клиента: ${esc(order.customer_comment)}</p>` : ""}
    <table style="margin:10px 0;"><thead><tr><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead>
      <tbody>${itemRows || `<tr><td colspan="4" class="muted">Нет строк</td></tr>`}</tbody></table>
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
  $("saveOrder").addEventListener("click", () => saveOrder(id));
}

async function saveOrder(id) {
  const msg = $("saveMsg");
  msg.textContent = "Сохранение…";
  let error;
  try {
    ({ error } = await supabase
      .from("orders")
      .update({ status: $("editStatus").value, manager_comment: $("editComment").value })
      .eq("id", id));
  } catch (err) {
    error = err;
  }
  msg.textContent = error ? friendlyError(error) : "Сохранено ✓";
}

function wire() {
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("loginError");
    show(err, false);
    let error;
    try {
      ({ error } = await supabase.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value,
      }));
    } catch (ex) {
      error = ex;
    }
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
