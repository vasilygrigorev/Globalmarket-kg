# Admin manual check (preview)

Quick manual smoke for the orders admin at `/admin/` on the preview deployment.
No secrets in this doc. Preview only — do not test against production.

Preview: `https://shared-layout-preview.globalmarket-kg.pages.dev/admin/`

## Before you start

- `admin/config.js` exists locally with the **anon** (publishable) key only
  (never service_role); it is git-ignored.
- `python3 scripts/check_backend_env_shape.py` shows no forbidden secret.

## Steps

1. **Not configured** (only if `config.js` is missing): the page shows the
   "Админка не настроена" banner. Expected.
2. **Login** — open `/admin/`, you should see "Вход для менеджера".
   - Wrong password → red banner with a readable message; button returns from
     "Входим…" to "Войти".
   - Correct admin login → orders list.
3. **No-access** — sign in as a non-admin user (no `app_metadata.is_admin`):
   the "Нет доступа к заказам" screen shows, and no order data appears.
4. **List** — orders load newest-first; "Показано N заказов" appears; the hint
   "Нажмите на строку заказа…" is visible.
   - Status filter and date-period filter (Сегодня / 7 дней / 30 дней) narrow
     the list; "Сумма показанных" updates with the visible orders.
   - Search by phone/name narrows the list; an empty result shows
     "По этому фильтру заказов нет".
5. **Order detail** — click a row:
   - customer name/phone, date, items, total, then a facts block: Адрес,
     Комментарий клиента, Источник рекламы, Промокод, Согласие на акции;
   - statuses show Russian labels (Новый/Связались/Подтверждён/Выполнен/Отменён);
   - "Написать клиенту в WhatsApp" link opens wa.me to the customer's number;
   - change Status and edit "Комментарий менеджера" → click "Сохранить":
     button disables, then "Сохранено ✓" (green). Reopen the order to confirm
     it persisted.
6. **Loading/empty** — a slow network shows "Загрузка…"; a project with no
   orders shows "Заказов пока нет".
7. **Sign out** — "Выйти" returns to the login screen; no data remains visible.

## If something fails

- Permission/RLS errors → confirm the user has `app_metadata.is_admin = true`.
- "Сессия истекла" → sign in again.
- Network errors → check the preview is up and env vars are set.

Rollback is unaffected: this is read/update of orders only; the storefront
checkout flag and WhatsApp flow are separate
([`backend-go-live-checklist.md`](backend-go-live-checklist.md)).
