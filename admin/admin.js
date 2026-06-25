// Admin orders page logic. Uses Supabase JS (anon key) + an authenticated admin
// session. RLS (public.is_admin()) does the real access control — see
// docs/admin-orders-spec.md. No service-role key is used here.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle("hidden", !on);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}
function money(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("ru-RU")} сом`;
}
function when(ts) {
  try { return new Date(ts).toLocaleString("ru-RU"); } catch { return ts || ""; }
}

const STATUSES = ["new", "contacted", "confirmed", "completed", "cancelled"];

const URL_ = window.GM_SUPABASE_URL;
const KEY_ = window.GM_SUPABASE_ANON_KEY;
const configured =
  !window.__gmConfigMissing &&
  typeof URL_ === "string" && URL_.startsWith("http") && !URL_.includes("YOUR-PROJECT") &&
  typeof KEY_ === "string" && KEY_ && !KEY_.includes("YOUR-ANON");

let supabase = null;

function setView(name) {
  show($("loginView"), name === "login");
  show($("listView"), name === "list");
  show($("detailView"), name === "detail");
}

async function refreshSessionUI() {
  const { data } = await supabase.auth.getSession();
  const session = data && data.session;
  $("who").textContent = session ? (session.user.email || "вошли") : "";
  show($("signOut"), Boolean(session));
  if (session) {
    setView("list");
    loadOrders();
  } else {
    setView("login");
  }
}

async function loadOrders() {
  const body = $("ordersBody");
  body.innerHTML = `<tr><td colspan="7" class="muted" style="padding:16px;">Загрузка…</td></tr>`;
  let query = supabase
    .from("orders")
    .select("id,created_at,status,total_kgs,customer_name,customer_phone,city,customer_source")
    .order("created_at", { ascending: false })
    .limit(100);
  const status = $("statusFilter").value;
  if (status) query = query.eq("status", status);
  const q = $("search").value.trim();
  if (q) query = query.or(`customer_phone.ilike.%${q}%,customer_name.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) {
    body.innerHTML = `<tr><td colspan="7" class="banner" style="margin:0;">Ошибка или нет доступа: ${esc(error.message)}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="muted" style="padding:16px;">Заказов нет (или нет прав администратора).</td></tr>`;
    return;
  }
  body.innerHTML = data.map((o) => `
    <tr data-id="${esc(o.id)}" style="cursor:pointer;">
      <td>${esc(when(o.created_at))}</td>
      <td>${esc(o.customer_name)}</td>
      <td>${esc(o.customer_phone)}</td>
      <td>${esc(o.city)}</td>
      <td>${esc(money(o.total_kgs))}</td>
      <td><span class="status">${esc(o.status)}</span></td>
      <td>${esc(o.customer_source)}</td>
    </tr>`).join("");
  body.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => openOrder(tr.dataset.id));
  });
}

async function openOrder(id) {
  setView("detail");
  const box = $("detailBody");
  box.innerHTML = `<p class="muted">Загрузка…</p>`;
  const [{ data: order, error: e1 }, { data: items }, { data: attr }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).single(),
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("marketing_attribution").select("*").eq("order_id", id),
  ]);
  if (e1 || !order) {
    box.innerHTML = `<p class="banner" style="margin:0;">Не удалось загрузить заказ: ${esc(e1 && e1.message)}</p>`;
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
        <select id="editStatus">${STATUSES.map((s) => `<option value="${s}" ${s === order.status ? "selected" : ""}>${s}</option>`).join("")}</select>
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
  const { error } = await supabase
    .from("orders")
    .update({ status: $("editStatus").value, manager_comment: $("editComment").value })
    .eq("id", id);
  msg.textContent = error ? `Ошибка: ${error.message}` : "Сохранено ✓";
}

function wire() {
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("loginError");
    show(err, false);
    const { error } = await supabase.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value,
    });
    if (error) { err.textContent = error.message; show(err, true); return; }
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
  supabase = createClient(URL_, KEY_);
  wire();
  refreshSessionUI();
}

init();
