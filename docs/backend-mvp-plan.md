# Backend MVP Plan

Цель первого backend-этапа: добавить историю заказов и основу клиентской базы, не ломая текущий статический магазин и заказ через WhatsApp.

## Главное решение

Первым динамическим слоем делаем не полный маркетплейс, а прием заказов в базу.

Каталог, фото, SEO-страницы и баннеры пока остаются статически генерируемыми. Это сохраняет скорость сайта, дешевый хостинг и текущий рабочий процесс с Петей, 1C-выгрузками и генераторами.

Динамическими становятся:

- сохранение заказа;
- история заказов;
- статусы заказа;
- менеджерские комментарии;
- клиентские контакты;
- рекламный источник заказа.

WhatsApp остается основным каналом связи: после отправки заказа сайт по-прежнему открывает сообщение менеджеру, но параллельно сохраняет заказ в Supabase.

## Что остается статическим

- `data/public-catalog.json`;
- карточки товаров;
- категории, бренды, коллекции;
- product pages;
- sitemap;
- robots;
- header/footer/menu/banner config;
- фото товаров и правила галерей.

Это можно потом перенести в базу, но не первым шагом. Главная ценность backend сейчас - заказы и администрирование.

## Что становится динамическим

- `orders`;
- `order_items`;
- `customers`;
- `customer_consents`;
- `marketing_attribution`;
- `admin_users` или роли через Supabase Auth;
- в будущем `product_reviews`.

## Supabase MVP Tables

### customers

Назначение: мягкая карточка клиента без обязательной регистрации.

Минимальные поля:

- `id uuid primary key`;
- `created_at timestamptz`;
- `updated_at timestamptz`;
- `name text`;
- `phone text`;
- `whatsapp text`;
- `city text`;
- `region text`;
- `address text`;
- `customer_type text default 'retail'`;
- `default_discount_percent numeric default 3`;
- `notes text`.

На первом этапе клиент может создаваться автоматически при заказе по телефону/WhatsApp. Полной регистрации пока нет.

### orders

Назначение: шапка заказа.

Минимальные поля:

- `id uuid primary key`;
- `created_at timestamptz`;
- `customer_id uuid null`;
- `status text default 'new'`;
- `total_kgs numeric`;
- `customer_name text`;
- `customer_phone text`;
- `city text`;
- `region text`;
- `address text`;
- `customer_comment text`;
- `manager_comment text`;
- `customer_source text`;
- `promo_code text`;
- `whatsapp_message text`;
- `sent_to_whatsapp boolean default false`.

Статусы MVP:

- `new`;
- `contacted`;
- `confirmed`;
- `completed`;
- `cancelled`.

### order_items

Назначение: строки заказа с ценой на момент заказа.

Минимальные поля:

- `id uuid primary key`;
- `order_id uuid references orders(id)`;
- `product_id text`;
- `product_slug text`;
- `title_snapshot text`;
- `brand_snapshot text`;
- `unit_snapshot text`;
- `qty integer`;
- `price_kgs numeric`;
- `line_total_kgs numeric`;
- `image_snapshot text`.

Важно: цена и название фиксируются snapshot-ом. Если завтра 1C поменяет цену или название, старый заказ не должен переписаться.

### marketing_attribution

Назначение: источник заказа.

Минимальные поля:

- `id uuid primary key`;
- `order_id uuid references orders(id)`;
- `customer_id uuid null`;
- `utm_source text`;
- `utm_medium text`;
- `utm_campaign text`;
- `utm_content text`;
- `utm_term text`;
- `referrer text`;
- `first_seen_at timestamptz`;
- `last_seen_at timestamptz`;
- `manual_source text`;
- `promo_code text`.

Источник не выводится из номера телефона. Только UTM/referrer/ручной выбор/промокод.

### customer_consents

Назначение: согласия на обратную связь и акции.

Минимальные поля:

- `id uuid primary key`;
- `customer_id uuid null`;
- `order_id uuid null`;
- `consent_type text`;
- `is_granted boolean`;
- `created_at timestamptz`;
- `source text`;
- `text_version text`.

Согласие не является обязательным для заказа.

## Product Reviews Later

Отзывы можно добавить позже без переделки MVP.

Будущие таблицы:

- `product_reviews`;
- `review_votes`;
- `review_media`.

Минимальная логика:

- отзыв можно оставить только после подтвержденного заказа или ручной модерации;
- публикация после проверки администратором;
- рейтинг хранится отдельно от текста;
- у товара показываем только опубликованные отзывы.

На текущем этапе достаточно заложить, что `orders` и `order_items` позже позволят проверить факт покупки.

## API Layer

Первый API endpoint:

- `POST /api/orders`

Он принимает:

- клиентские поля;
- корзину;
- attribution;
- согласие;
- итоговую сумму;
- готовый WhatsApp-текст.

Ответ:

- `order_id`;
- `status`;
- `manager_whatsapp_url`.

После успешного ответа frontend открывает WhatsApp как сейчас. Если API временно недоступен, сайт должен fallback-ом открыть WhatsApp без сохранения в базу и показать клиенту обычный сценарий.

## Admin MVP

Первая админка не должна быть большой CRM.

Минимальные экраны:

- список заказов;
- карточка заказа;
- смена статуса;
- комментарий менеджера;
- поиск по телефону/имени;
- фильтр по статусу;
- просмотр источника рекламы.

Кто работает:

- владелец: полный доступ;
- менеджер: заказы и комментарии, без системных настроек.

## Recommended Implementation Order

1. Создать Supabase проект.
2. Создать SQL migrations для MVP tables.
3. Настроить `.env` локально, не коммитить ключи.
4. Добавить backend client/config в проект.
5. Сделать `POST /api/orders` или Supabase insert через безопасный server/edge слой.
6. Подключить frontend checkout: сохранить заказ, затем открыть WhatsApp.
7. Сделать простую админ-страницу заказов.
8. Добавить роли владельца и менеджера.
9. Только после этого думать о переносе каталога в базу.

## Security And Privacy Rules

- Не хранить пароли в своем коде.
- Не коммитить Supabase keys и `.env`.
- На frontend можно использовать только public anon key, если RLS настроен правильно.
- Service role key только на сервере/edge function.
- Клиент не должен читать чужие заказы.
- Менеджер не должен видеть системные ключи.
- Согласие на акции отдельно от факта заказа.
- Номер WhatsApp не считается рекламным источником.

## Migration Boundary

Первый backend-этап считается готовым, когда:

- заказ сохраняется в базе;
- WhatsApp продолжает открываться;
- есть список заказов для администратора;
- статусы заказа меняются;
- данные UTM/source попадают в заказ;
- сайт продолжает собираться статически;
- production deploy можно откатить на предыдущий commit.

## Что не делаем в первом backend-этапе

- полный личный кабинет клиента;
- оплату онлайн;
- синхронизацию обратно в 1C;
- массовый перенос товаров в Supabase;
- сложную CRM;
- автоматические WhatsApp Business рассылки;
- отзывы без модерации;
- Meta Pixel и Google Analytics.

