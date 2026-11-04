# AANI GEMAS — Backend + Admin Panel Brief

You are building the backend and admin panel for **AANI GEMAS**, an online fine-jewelry store (18K gold rings, necklaces, earrings, bracelets, plus a "Design Your Ring" configurator). Read this whole brief before writing code.

## 0. Context

- There is a **separate storefront repo** (`web_annigems`, React 19 + Vite + React Router 7). Today it is frontend-only: all data is hard-coded in `src/data/*.js` and cart/auth/orders live in `localStorage`. After you finish, that storefront will only do **API integration** against what you build. A **mobile app** will use the same backend later.
- **This repo** currently contains an **AdminLTE admin design** (static). Your job: turn this repo into a **Laravel + React + MySQL** project that:
  1. is the **single source of truth** for all store data (catalog, configurator, pricing, gold rate, currencies, customers, orders, payments, content),
  2. exposes **Web storefront APIs** and **Mobile app APIs**,
  3. has an **admin panel (React SPA) built with the existing AdminLTE design**, from which everything is managed.
- **Out of scope for now: the B2B / wholesale module.** Do not build it. Keep the schema extensible (see §3.1 `account_type`).
- Two files come with this brief. Commit them to the repo before you start if they are not already there:
  - `database/seeders/data/storefront-seed.json`: every piece of content and catalog data from the storefront (products, categories, configurator rings/stones, policies, FAQs, about, services, navigation, testimonials, shipping methods, coupons…). **Seed from this file. Do not invent content.**
  - `database/seeders/data/images/`: the storefront's `public/images` folder. Image paths in the JSON (`/images/x.jpg`) refer to it.

## 1. Tech stack (fixed)

- **Laravel 12** (latest stable), PHP 8.3+, **MySQL 8**.
- **React 19 + Vite + React Router** admin SPA inside the Laravel project (`resources/js/admin/`), served by Laravel at `/admin/*` (catch-all Blade view that mounts React).
- **Laravel Sanctum**:
  - Admin SPA: stateful cookie/session auth on the same domain, separate `admin` guard.
  - Web storefront and mobile app: **Bearer personal access tokens** (`Authorization: Bearer <token>`), customer guard. Token expiry configurable (default 30 days).
- `spatie/laravel-permission` for staff roles and permissions; `pragmarx/google2fa` (or Fortify 2FA) for TOTP; `spatie/laravel-activitylog` for the admin audit log.
- `stripe/stripe-php` for payments; `google/apiclient` (or firebase/php-jwt with Google certs) to verify Google ID tokens.
- Queue: `database` driver. Scheduler for gold-rate and currency fetches and stale-order cleanup.
- Mail: SMTP from `.env` (Mailtrap in dev). Every customer email is a queued Mailable with a simple branded Blade template.
- Storage: `public` disk (local), S3-ready via config.
- API docs: **Scribe** (`knuckleswtf/scribe`) at `/docs`, with separate groups for Web, Mobile and Admin. Also export a Postman collection.
- Tests: Pest (or PHPUnit) feature tests.
- Admin UI libs: AdminLTE CSS from the existing design (no jQuery plugins; use React equivalents), `react-chartjs-2` for charts, a small in-house DataTable component with server-side pagination, sorting and filters.

## 2. Global rules

1. **Money is stored as integers in minor units** (cents), `BIGINT UNSIGNED`. Never use floats for money.
2. **Base currency = EUR.** Every admin-entered price (products, craft fees, stone prices, shipping, coupon fixed amounts, gold rate per oz) is in EUR.
3. **Multi-currency at launch: EUR, USD, INR, AED, GBP** (admin can enable or disable each). Clients send the currency in the `X-Currency` header (default EUR; an unknown or disabled currency falls back to EUR and the response `meta.currency` says which was used).
4. **The server prices everything.** Never trust prices, totals or discounts sent by a client. The client sends only ids, qty, size and codes.
5. Every money value in API responses uses one shape:
   `{ "amount": 82137, "currency": "EUR", "formatted": "€821.37" }`
6. API JSON: Laravel API Resources, `{ data, meta, links }` for lists (standard pagination, `per_page` max 50), validation errors with the standard 422 shape `{ message, errors }`.
7. Versioned prefixes: `/api/v1/web/*`, `/api/v1/mobile/*`, `/api/v1/admin/*`, `/api/v1/webhooks/*`. Web and mobile share the same controllers and services. Separate route files (`routes/api/web.php`, `routes/api/mobile.php`) let the platforms diverge where §6 says so.
8. Keep business logic in **service classes** (`PricingService`, `GoldRateService`, `CurrencyService`, `CartQuoteService`, `CheckoutService`, `PaymentService`, `CouponService`, `OrderService`), not in controllers.
9. Rate-limit login, register, Google, forgot/reset password, contact, newsletter and coupon checks.
10. Validation messages must be user-friendly; the storefront shows them as they are.

## 3. Data model (MySQL)

Every table has `id` and timestamps unless noted. Use soft deletes on catalog and customer tables.

### 3.1 Customers
- **users** (customers only): first_name, last_name, email (unique, lowercase), password (nullable for Google-only), google_id (nullable, unique), avatar_url, phone, preferred_currency (char 3, nullable), **account_type** enum(`customer`) default `customer` (B2B is added later), is_active, last_login_at, deleted_at.
  - Password rule: min 8 characters (same as the storefront).
- **addresses**: user_id, label ("Home"/"Office"), name, phone, line1, city, state (nullable), zip, country_code, is_default. Only one default per user; the first address becomes the default.
- **password_reset_codes**: email, code_hash, expires_at (15 min), attempts (max 5), used_at.
- Sanctum `personal_access_tokens` (store `device_name` and platform `web`/`mobile` in the token name or abilities).

### 3.2 Staff (admin)
- **admin_users**: name, email, password, is_active, two_factor_secret (encrypted), two_factor_recovery_codes (encrypted), two_factor_confirmed_at, last_login_at.
- spatie roles and permissions on the `admin` guard. Seed roles:
  - **Super Admin**: everything, including staff, roles and settings.
  - **Manager**: catalog, configurator, pricing (gold, currencies, shipping, tax), coupons, orders (all actions incl. refunds), customers, content, messages.
  - **Support**: view orders, update order stage and tracking, view customers, messages.
- **2FA is mandatory for every staff user.** On first login, force TOTP setup (QR code and recovery codes) before any other screen. Staff password reset by email link.

### 3.3 Catalog
- **categories**: name, slug, image, sort_order, is_active. Seed: rings, necklaces, earrings, bracelets. The storefront's "count" is computed from active products.
- **products**: category_id, sku (nullable), slug (unique), name, subtitle, description (text), price (EUR minor), compare_at_price (nullable; storefront `originalPrice`, shown as Sale), badge (nullable enum: Bestseller, Sale, New, Limited, Iconic), metal (text, e.g. "18K Gold"), stone (text: Diamond/Ruby/Sapphire/Emerald/No Stone, used by the stone filter), weight (text, e.g. "3.2g"), details (json array of strings), tags (json array), rating (decimal 2,1, admin-set display value), reviews_count (int, admin-set display value), has_sizes (bool), sizes (json array; default the ring sizes list from the seed), stock_qty (int), track_stock (bool, default true), is_customizable (bool, shows the Design-Your-Ring link), is_featured + featured_sort, is_new_arrival + new_arrival_sort, is_active, published_at.
  - `in_stock` in the API = `!track_stock || stock_qty > 0`.
  - Products with `has_sizes = true` **require a size** in cart, quote and checkout (validate against `sizes`).
- **product_images**: product_id, path, alt, sort_order. The first image is the main `image`; all of them form the `gallery`.
- **product_reviews**: product_id (nullable = generic review shown on every product page, which is how the storefront works today), name, location, initials, rating, text, is_active, sort_order.
- **settings key** `catalog.rating_distribution` (json, from seed) for the reviews summary bars.
- Seed the 12 products with their storefront string ids (`r1`, `n1`, …) as `slug`s **or** add a `legacy_id` column so the storefront's existing links (`/product/r1`) keep working. Use `legacy_id`, and let `/products/{slugOrLegacyId}` accept both.

### 3.4 Design Your Ring (configurator)
Customer flow (do not change it): **choose ring → choose size → choose stone → preview → add to cart.** The customer **cannot** choose metal or karat; that comes with the ring.

- **config_rings**: name, slug, type (e.g. "Classic 4-Prong Cathedral"), setting (e.g. "4-Prong Cathedral"), **karat** (int: 9, 10, 14, 18, 22, 24), metal_color (nullable: yellow/white/rose, display only), **gold_weight_g** (decimal 8,3), **craft_fee** (EUR minor), **sizes** (json array of allowed US sizes; seed `4`–`12` in half sizes), image, description, delivery_text (default "4-6 weeks"), sort_order, is_active.
- **config_stones**: name, slug, origin, **price** (EUR minor, **fixed**), rarity (Rare/Premium/Elite…), carat (nullable decimal, display only), color (hex), glow (rgba string), gem_style (CSS gradient string, nullable), uses_diamond_animation (bool; the storefront renders the diamond with a CSS animation instead of a gradient), description, sort_order, is_active.
- **config_ring_stone** (combo pivot): ring_id, stone_id, image (the photo of that ring with that stone), is_active. A stone is offered for a ring only if the combo exists and is active **and** both ring and stone are active. If the combo has no image, fall back to the ring image.
- **Settings keys** for the size guide: `configurator.size_chart` (rows: us, diameter, circumference), `configurator.size_guide_steps`, `configurator.steps` (labels). All come from the seed.
- **No engraving** anywhere.

**Price formula** (single source: `PricingService::configuratorPrice(ring, stone)`), all in EUR then converted:
```
purity        = karat / 24
gold_per_gram = gold_rate_per_oz_eur / 31.1034768
gold_value    = gold_weight_g × purity × gold_per_gram
ring_charge   = gold_value + craft_fee
total         = ring_charge + stone.price
```
- Round `gold_value` to cents and sum in cents.
- **Ring size does not change the price.** It is only validated against `ring.sizes`.
- Example: Aurora (18K, 3.2 g, craft fee €180) + Ruby (€450) at €2480/oz gives gold = €191.36 and total = €821.36.

### 3.5 Gold rate
- **settings**: `gold.source` = `api` | `manual`; `gold.manual_rate_per_oz` (EUR minor); `gold.api_provider` (default `goldapi`); `gold.fetch_interval_minutes` (default 60).
- **gold_rates** (history): source (`api`/`manual`), rate_per_oz (EUR minor), fetched_at, provider, raw (json, nullable). The latest successful `api` row is the **last good API rate**.
- Rules (the client's exact requirement):
  - Whichever source is selected in admin is the one used. **There is no automatic switching between api and manual.**
  - With `api` selected, the store must never break when the provider fails:
    - The scheduler fetches every N minutes.
    - On failure, keep using the **last good API rate**, log the error, and show a warning on the admin dashboard and gold-rate screen ("API rate is X hours old").
  - Admin **cannot switch to `api`** until a "Test & fetch now" succeeds. That guarantees a last good rate always exists.
  - Provider: implement a `GoldRateProvider` interface with a **GoldAPI.io** driver (`GET https://www.goldapi.io/api/XAU/EUR`, header `x-access-token: GOLD_API_KEY`) and keep the interface open for other providers. Mind the provider's monthly request quota; that is why the interval is configurable.
- Each configurator price response includes `gold_rate: { per_oz, source, updated_at }`. The storefront shows "Gold: €X/oz".

### 3.6 Currencies
- **currencies**: code (EUR/USD/INR/AED/GBP), symbol, name, decimals (2), is_base (EUR only), is_active, sort_order.
- **settings**: `fx.source` = `api` | `manual` (same rule as gold: whichever is selected is used, no automatic switching; last good API rates are kept on failure; a successful test fetch is required before choosing `api`); `fx.fetch_interval_minutes` (default 720).
- **exchange_rates**: currency_code, rate (decimal 18,8: 1 EUR = rate × currency), source, fetched_at. Manual rates are edited per currency in admin.
- Default API driver: `https://open.er-api.com/v6/latest/EUR` (free, no key, includes AED and INR) behind an `ExchangeRateProvider` interface.
- Conversion: `display_minor = round(eur_minor × rate)`. Convert **each unit price** first, then compute line totals and order totals in the target currency, so the numbers the customer sees always add up.
- Stripe charges in the **order's currency**. Check that the client's Stripe account supports all five; note any restriction in the README.

### 3.7 Commerce settings
- **settings**: `tax.rate` (decimal; seed 0.08, one flat rate applied to (subtotal − discount), not to shipping), `shipping.free_threshold` (EUR minor; seed 500.00).
- **shipping_methods**: code, name, delivery_time (text), price (EUR minor), free_over_threshold (bool), is_active, sort_order. Seed: standard (€25, free over threshold, "5-7 business days"), express (€45, "2-3 business days"), overnight (€95, "Next business day").
- **countries**: code, name, is_active (shipping allowed), sort_order. Seed: India, United States, United Kingdom, UAE, plus the main EU countries.
- **coupons**: code (unique, uppercase), type (`percent` | `fixed`), value (percent value or EUR minor), min_subtotal (EUR minor, nullable), starts_at, expires_at, usage_limit (nullable), per_user_limit (nullable), used_count, is_active. Seed: `AANI10` (10%), `WELCOME15` (15%). A coupon applies to the whole cart, custom rings included. Increment `used_count` only when the order is paid.

**Totals formula** (same as the storefront today):
```
subtotal  = Σ line totals
discount  = coupon on subtotal (percent rounded to cents, or fixed amount, never more than subtotal)
taxable   = subtotal − discount
shipping  = method.price, or 0 if method.free_over_threshold and taxable ≥ free_threshold (converted)
tax       = round(taxable × tax.rate)
total     = taxable + shipping + tax
```

### 3.8 Orders & payments
- **orders**:
  - Identity: order_number (unique, `AG-` + sequence starting at `AG-10001`), user_id, email, placed_from (`web`/`mobile`).
  - Money: currency, exchange_rate (EUR→currency snapshot), subtotal, discount, shipping, tax, total (all in the order currency, minor), total_eur (minor), coupon_code (nullable), coupon_snapshot (json).
  - Shipping: shipping_method_code, shipping_method_name, shipping_delivery_time, and the address snapshot: ship_name, ship_phone, ship_line1, ship_city, ship_state, ship_zip, ship_country.
  - **status**: `pending_payment` | `paid` | `payment_failed` | `cancelled` | `refunded` | `partially_refunded`.
  - **stage** (fulfilment, used only once paid): `placed` → `crafting` → `quality_check` → `shipped` → `delivered`.
  - Payment: stripe_payment_intent_id, stripe_customer_id, refunded_amount, paid_at.
  - Fulfilment: carrier, tracking_number, tracking_url, shipped_at, delivered_at, cancelled_at, cancel_reason.
  - Notes: customer_note (nullable), stock_issue (bool).
- **order_items**: order_id, **kind** (`product` | `custom_ring`), product_id (nullable), config_ring_id (nullable), config_stone_id (nullable), name, subtitle, image, size, qty, unit_price, line_total (order currency, minor), unit_price_eur, **snapshot** (json):
  - product: sku, slug, metal, stone, compare_at_price.
  - custom_ring: ring name, setting, karat, metal_color, gold_weight_g, gold_rate_per_oz_eur, gold_rate_source, gold_value_eur, craft_fee_eur, stone name, stone_price_eur, ring_charge_eur, delivery_text.

  Snapshots never change after the order is created, so later gold-rate or price changes don't affect old orders.
- **order_status_history**: order_id, field (`status`/`stage`), from, to, note, admin_user_id (nullable = system), customer_notified (bool).
- **order_notes** (internal, staff only): order_id, admin_user_id, body.
- **stripe_events**: event_id (unique), type, processed_at, payload (json). Makes the webhook idempotent.
- **Seed `order_stages`** (labels and descriptions) from the seed JSON so the storefront timeline text comes from the API.

### 3.9 Wishlist, forms
- **wishlists**: user_id, product_id (unique pair).
- **contact_messages**: name, email, topic (seed topics: "Order enquiry", "Custom / bespoke ring", "Repairs & resizing", "Gold & gemstone advice", "Other"; stored as a setting so admin can edit), message, status (`new`/`read`/`replied`), replied_at, admin_user_id.
- **newsletter_subscribers**: email (unique), source (`web`/`mobile`), subscribed_at, unsubscribed_at.

### 3.10 Content (CMS): everything is editable from admin
- **content_blocks**: key (unique), value (json), updated_by. Seed every block from the seed JSON:
  - `brand` (name, logo, tagline lines, since)
  - `home.hero` (eyebrow, title lines, text, image, CTA)
  - `home.usp_items`, `home.category_section`, `home.design_ring_banner`, `home.testimonials_section`
  - `navigation.mega_menu` (columns + featured card), `navigation.mobile`, `footer.columns`, `footer.legal_links`
  - `contact` (address, phone, email, hours, whatsapp, map embed URL), `contact.topics`
  - `trust_points`, `payment_badges` (change to Stripe card brands only: VISA, MC, AMEX), `product.shipping_points`, `product.care_instructions`
  - `about` (story paragraphs, stats, values, milestones), `services` (cards)
  - `configurator.size_chart`, `configurator.size_guide_steps`, `catalog.sort_options`, `catalog.stone_filters`, `catalog.max_price_filter`, `catalog.rating_distribution`
- **pages** (policies): slug (`shipping-policy`, `returns`, `privacy-policy`, `terms`, `warranty`), title, eyebrow, intro, updated_label, sections (json: `[{id, heading, body: [paragraph…]}]`), is_active.
- **faq_categories** (name, sort_order) and **faqs** (category_id, question, answer, sort_order, is_active).
- **testimonials**: name, location, rating, initials, product_label, text, is_active, sort_order.
- Featured and new-arrival products are managed by the product flags (§3.3), seeded from `home.featuredProductIds` / `home.newArrivalProductIds`.
- Content fixes while seeding: in the FAQ answer "Which payment methods do you accept?" use "Visa, Mastercard and American Express via Stripe". In "Can I track my order?" say tracking is in My Account. Leave everything else as it is.

## 4. Core flows (behaviour)

### 4.1 Customer auth
- **Register**: first_name, last_name, email, password (+ password_confirmation; the storefront also checks a "terms" box). Returns user + token.
- **Login**: email + password. Returns user + token. Errors:
  - unknown email → "No account found with this email."
  - wrong password → "Incorrect password. Please try again."
  - Google-only account → "This account uses Google. Please continue with Google."
  - inactive → "This account is disabled. Please contact us."
- **Google**: the client sends a Google **ID token** (web: Google Identity Services; mobile: native Google Sign-In). Verify it against the allowed client ids (`GOOGLE_CLIENT_ID_WEB`, `_IOS`, `_ANDROID`).
  - Existing `google_id` → log in.
  - Existing user with the same verified email → link `google_id` and log in.
  - Otherwise create the user (no password).
- **Forgot password (web and mobile use the same flow, matching the storefront UI)**:
  1. `forgot-password` (email) → email a **6-digit code**, valid 15 min. Always respond with a generic success message.
  2. `verify-reset-code` (optional pre-check).
  3. `reset-password` (email, code, password, password_confirmation) → set password, revoke all tokens, send a "password changed" email.
  - Max 5 attempts per code.
- **Profile**: update first_name, last_name, phone, preferred_currency. Email change is out of scope.
- **Change password**: requires current_password, except for Google-only users setting their first password.
- **Delete account** (needed for app-store compliance): soft-delete, anonymise personal data, revoke tokens. Orders are kept for accounting.
- Logout revokes the current token. "Logout all devices" revokes all tokens.

### 4.2 Cart and quote
- **The cart lives on the client** (localStorage on web, device storage on mobile). Customers can add items **without logging in**. Login is required only at checkout.
- Cart line shapes the client sends:
  - `{ "type": "product", "product_id": 12, "qty": 1, "size": "7" }` (size is required when `has_sizes`)
  - `{ "type": "custom_ring", "ring_id": 1, "stone_id": 3, "size": "6.5", "qty": 1 }`
- **`POST /cart/quote`** (public) prices the cart: lines (name, image, unit price, line total, availability, errors per line such as `out_of_stock`, `inactive`, `invalid_size`, `combo_unavailable`), coupon result, shipping options with cost, totals, gold rate used. Clients call it on cart and checkout pages, and whenever the currency changes.

### 4.3 Checkout and Stripe (full payment upfront, card only)
1. Authenticated `POST /checkout` with: items, `address_id` **or** an inline address (`save_address: bool`), shipping_method, coupon_code, customer_note. Requires an `Idempotency-Key` header.
2. The server re-quotes, validates stock, sizes and combos, then creates the **order (`pending_payment`) with items and snapshots** inside a DB transaction.
3. It creates (or reuses) a **Stripe Customer** for the user and a **PaymentIntent**: amount = total, currency = order currency, `payment_method_types: ['card']`, metadata `{order_id, order_number}`, `receipt_email`.
4. Response: order summary, `payment: { client_secret, publishable_key }`. Mobile additionally gets `customer_id` and `ephemeral_key` for Stripe PaymentSheet (§6).
5. The client confirms the payment with Stripe (Payment Element on web, PaymentSheet on mobile), then polls `GET /orders/{number}` until `status` is `paid` or `payment_failed`.
6. **Only the webhook marks orders paid.** `POST /api/v1/webhooks/stripe` verifies the signature with `STRIPE_WEBHOOK_SECRET` and is idempotent via `stripe_events`:
   - `payment_intent.succeeded` → status `paid`, stage `placed`, paid_at, decrement stock (set `stock_issue` if it goes negative instead of failing), increment coupon usage, history entry, queue the "Order confirmed" email (+ admin notification email).
   - `payment_intent.payment_failed` → status `payment_failed`, keep the order so the customer can retry.
   - `charge.refunded` → refunded_amount, status `refunded` / `partially_refunded`.
7. Retry: `POST /orders/{number}/pay` returns a fresh client_secret for `pending_payment` / `payment_failed` orders. It re-validates stock first. **Prices stay as snapshotted.**
8. Cancel: the customer may cancel their own order only while it is `pending_payment` / `payment_failed` (this also cancels the PaymentIntent).
9. A scheduled job cancels `pending_payment` orders older than `orders.pending_ttl_hours` (setting, default 24).

### 4.4 Fulfilment (admin)
- Stages move forward only: `placed` → `crafting` → `quality_check` → `shipped` (requires carrier + tracking number, and optionally a URL) → `delivered`. Admin can step back one stage with a note.
- Each change writes history. A "Notify customer" checkbox (default on) sends the stage email.
- Refunds (full or partial) are issued from admin through the Stripe API. The webhook updates the order status.
- Custom-ring lines show their full price breakdown in admin.

## 5. Admin panel (React SPA, AdminLTE design)

Before building, **inspect the AdminLTE design in this repo** and reuse its layout, CSS and components (sidebar, top navbar, content header with breadcrumbs, cards, tables, forms, badges, small-boxes, callouts) as React components. Keep its look. Every screen enforces permissions (both in the UI and in the API).

1. **Auth**: login, forced 2FA setup, 2FA challenge (TOTP or recovery code), staff forgot/reset password, profile (change password, regenerate recovery codes), logout. Session idle timeout.
2. **Dashboard**:
   - KPIs (EUR): revenue today/7d/30d, paid orders, average order value, new customers.
   - Orders by status and stage; "to craft" queue (paid orders in `placed`/`crafting`); recent orders; low-stock products.
   - Gold-rate widget (current rate, source, age, warning if stale); FX status.
   - Revenue chart (30 days).
3. **Orders**:
   - List with filters (status, stage, date range, currency, platform, search by number/email/name) and CSV export.
   - Detail: items (custom-ring breakdown), customer, address, totals in order currency + EUR, Stripe PI id with a dashboard link, status/stage timeline, internal notes.
   - Actions: change stage (+ tracking), cancel unpaid, refund (full/partial), resend confirmation email, printable invoice and packing slip (HTML print view or PDF via dompdf).
4. **Customers**: list/search, detail (profile, addresses, orders, wishlist, lifetime value), activate/deactivate, send password-reset code. Never show passwords.
5. **Catalog**:
   - Products CRUD: multi-image upload with drag reorder, details/tags editors, sizes, badge, featured/new flags + ordering, stock, active.
   - Categories CRUD (image, order).
   - Product reviews CRUD.
6. **Design Your Ring**:
   - Rings CRUD (karat, metal color, gold weight, craft fee, allowed sizes multi-select, image, delivery text, order, active).
   - Stones CRUD (price, carat, rarity, color/glow/gem style with a live swatch preview, diamond animation flag).
   - **Combos matrix** (rings × stones grid: toggle active, upload combo image).
   - **Price preview calculator** (pick ring + stone, see the breakdown with the current gold rate in EUR and every active currency).
   - Size chart and guide steps editor.
7. **Pricing & settings**:
   - Gold rate: source toggle (api/manual with the "test before switching" rule), manual rate, fetch interval, "Fetch now", history table + chart, provider status.
   - Currencies: enable/disable, FX source, manual rates, fetch now, last fetched.
   - Tax rate, free-shipping threshold, shipping methods CRUD, countries, pending-order TTL.
8. **Coupons**: CRUD and usage stats.
9. **Content**: structured forms (not raw JSON) for every content block in §3.10, policies pages (sections and paragraphs editor), FAQs (categories + items, drag order), testimonials, contact topics, image uploads.
10. **Messages**: contact messages inbox (status, reply via mailto or reply-email action). Newsletter subscribers with CSV export.
11. **Staff & roles** (Super Admin): staff CRUD, role assignment, permission matrix, reset a staff member's 2FA.
12. **Activity log**: who changed what (catalog, pricing, orders, settings, content).
13. **App settings**: store name/emails, mobile `min_app_version` and `latest_app_version` per platform, `force_update`, maintenance mode flag + message (returned by bootstrap).

Stripe keys, Google client ids and provider API keys live **only in `.env`**, never in the DB or admin UI. The admin shows only whether Stripe is in test or live mode.

## 6. API endpoints

Prefix `{p}` = `/api/v1/web` or `/api/v1/mobile`. Unless marked, an endpoint exists on both with identical behaviour. 🔒 = customer Bearer token required.

### Store / content (public)
| Method | Path | Notes |
|---|---|---|
| GET | `{p}/bootstrap` | brand, navigation, footer, contact, trust points, payment badges, currencies (active + rates), default currency, tax rate, free-shipping threshold, shipping methods, countries, order stages, contact topics, catalog sort options / stone filters / max price, `stripe_publishable_key`, Google client id for the platform, gold rate summary. **Mobile only adds** `app: {min_version, latest_version, force_update, maintenance}`. |
| GET | `{p}/home` | hero, USP items, category section + categories (with counts), featured products, new arrivals, design-ring banner, testimonials section + testimonials |
| GET | `{p}/categories` | |
| GET | `{p}/products` | filters: `category`, `stone[]`, `min_price`, `max_price` (in the request currency), `search`, `featured`, `new`, `in_stock`; `sort` = featured, price-asc, price-desc, rating, newest; paginated |
| GET | `{p}/products/{slugOrLegacyId}` | full product, gallery, sizes, related (same category, 4), reviews (product + generic), rating distribution, shipping points, care instructions |
| GET | `{p}/search?q=` | quick search (name, subtitle, tags, category), max 8 results |
| GET | `{p}/configurator` | steps, rings (with sizes, karat, ring_charge in currency), stones, active combos with images, size chart, guide steps, gold rate |
| POST | `{p}/configurator/price` | `{ring_id, stone_id, size}` → full breakdown (gold value, craft fee, ring charge, stone price, total, gold rate used) |
| POST | `{p}/cart/quote` | see §4.2 |
| GET | `{p}/pages/{slug}` | policy page |
| GET | `{p}/faqs` | grouped by category |
| GET | `{p}/about` | |
| GET | `{p}/services` | |
| POST | `{p}/contact` | name, email, topic, message |
| POST | `{p}/newsletter` | email |

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `{p}/auth/register` | mobile also requires `device_name` |
| POST | `{p}/auth/login` | mobile also requires `device_name` |
| POST | `{p}/auth/google` | `{id_token}`; verified against the platform's client ids |
| POST | `{p}/auth/forgot-password` | sends the 6-digit code |
| POST | `{p}/auth/verify-reset-code` | |
| POST | `{p}/auth/reset-password` | |
| POST | `{p}/auth/logout` 🔒 | current token |
| POST | `{p}/auth/logout-all` 🔒 | |

### Account 🔒
| Method | Path | Notes |
|---|---|---|
| GET / PUT | `{p}/me` | profile |
| PUT | `{p}/me/password` | |
| DELETE | `{p}/me` | delete account (§4.1) |
| GET / POST | `{p}/me/addresses` | |
| PUT / DELETE | `{p}/me/addresses/{id}` | |
| POST | `{p}/me/addresses/{id}/default` | |
| GET | `{p}/wishlist` | products |
| POST / DELETE | `{p}/wishlist/{productId}` | |
| POST | `{p}/wishlist/sync` | `{product_ids: []}` merges the guest wishlist after login, returns the full list |

### Checkout & orders 🔒
| Method | Path | Notes |
|---|---|---|
| POST | `{p}/checkout` | §4.3. **Web** returns `payment: {client_secret, publishable_key}`. **Mobile** returns `payment: {client_secret, publishable_key, customer_id, ephemeral_key}` (PaymentSheet). |
| GET | `{p}/orders` | paginated, newest first |
| GET | `{p}/orders/{number}` | full order, items, totals, status, stage, timeline (history with stage labels and descriptions), tracking info |
| POST | `{p}/orders/{number}/pay` | retry payment (same platform-specific payment payload) |
| POST | `{p}/orders/{number}/cancel` | only `pending_payment` / `payment_failed` |
| POST | `{p}/orders/{number}/reorder` | returns the cart lines for still-available items (the client puts them back in its cart) |

### Mobile-only
| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/mobile/devices` 🔒 | register a push token `{token, platform: ios/android}`. Store it only; push sending is a later phase. |
| DELETE | `/api/v1/mobile/devices/{token}` 🔒 | |

### Webhooks
| Method | Path |
|---|---|
| POST | `/api/v1/webhooks/stripe` |

### Admin API
`/api/v1/admin/*` is used by the admin SPA: session + `admin` guard + 2FA-confirmed middleware + permissions. Build RESTful resources for every admin module in §5 (orders and their actions, customers, products, product images, categories, reviews, config rings, stones, combos, price preview, gold rate, currencies, settings, shipping methods, countries, coupons, content blocks, pages, FAQs, testimonials, messages, newsletter, staff, roles, activity log, dashboard stats, media upload).

## 7. Emails (queued, branded)
Customer:
- welcome
- password reset code
- password changed
- order confirmed (paid), with items, custom-ring details and totals
- payment failed (with a retry link to the storefront order page)
- stage updates (crafting, quality check, shipped with tracking, delivered)
- order cancelled
- refund issued

Staff:
- new paid order
- new contact message
- gold-rate API failing for more than 3 consecutive fetches

Links in emails use `STOREFRONT_URL` (e.g. `{STOREFRONT_URL}/account/orders/{number}`).

## 8. Seeding
- `DatabaseSeeder` runs:
  - roles and permissions
  - Super Admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (2FA set up on first login)
  - everything in `storefront-seed.json` (treat its money values as EUR)
  - copy the images from `database/seeders/data/images` to the public disk
  - currencies (EUR base + USD, INR, AED, GBP with sensible manual starter rates)
  - `gold.source = manual`, with the seed's per-oz value as the manual EUR rate
- Rings in the seed get `karat: 18` and all sizes. Create a combo for every ring × stone from the stones' `images` map (`{ringId: imagePath}`).
- Demo customer (local/dev only): `demo@aanigems.com` / `Demo@1234`.
- Do **not** seed anything from B2B.

## 9. Environment variables (`.env.example`)
- App: `APP_URL`, `STOREFRONT_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Database: `DB_*`
- Mail: `MAIL_*` (+ `MAIL_ADMIN_NOTIFY`)
- Stripe: `STRIPE_KEY` (pk_test_…), `STRIPE_SECRET` (sk_test_…), `STRIPE_WEBHOOK_SECRET` (whsec_…)
- Google: `GOOGLE_CLIENT_ID_WEB`, `GOOGLE_CLIENT_ID_IOS`, `GOOGLE_CLIENT_ID_ANDROID`
- Rates: `GOLD_API_KEY`, `FX_API_URL`
- Sanctum/CORS: `SANCTUM_STATEFUL_DOMAINS` (admin), `CORS_ALLOWED_ORIGINS` (storefront origins, e.g. `http://localhost:5173`), `SANCTUM_TOKEN_EXPIRATION`

Use **Stripe test mode** only for now. In the README, document the local webhook setup (`stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe`) and the test cards:
- `4242 4242 4242 4242` succeeds
- `4000 0025 0000 3155` requires 3-D Secure
- `4000 0000 0000 9995` is declined

## 10. Tests (must pass)
- PricingService: configurator formula incl. karat purity, rounding, currency conversion; totals formula (coupon percent/fixed, free-shipping threshold on taxable, tax).
- Gold and FX source rules: selected source used, last good API rate kept on provider failure, switching to `api` blocked without a successful fetch.
- Quote rejects: invalid size, inactive product, inactive combo, out of stock; never accepts client prices.
- Checkout creates a pending order with correct snapshots + a PaymentIntent (mock Stripe). Webhook `succeeded` marks paid, decrements stock and increments the coupon once (the same event replayed twice has no double effect). Webhook `failed` marks failed; the retry endpoint works.
- Auth: register/login/Google (mock verifier)/reset code (expiry and attempt limit)/delete account.
- Admin: 2FA enforced; permission checks per role.

## 11. Deliverables & working method
- Work on a feature branch. Commit after each milestone with clear messages. Keep `docs/PROGRESS.md` updated (done / next / open questions).
- Milestones:
  1. Laravel + React admin shell with the AdminLTE layout; staff auth + mandatory 2FA + roles.
  2. Migrations, models, seeders (from `storefront-seed.json`).
  3. Pricing, gold-rate, FX services + public store/content/configurator/quote APIs.
  4. Customer auth (incl. Google, reset code) + account, addresses, wishlist APIs.
  5. Checkout, Stripe PaymentIntents, webhooks, orders APIs, emails, scheduled jobs.
  6. Admin modules: orders, customers, catalog, configurator, pricing, coupons.
  7. Admin content (CMS), messages, staff/roles, activity log, app settings.
  8. Scribe docs (Web / Mobile / Admin groups), Postman export, tests green, README.
- Also write **`docs/STOREFRONT_INTEGRATION.md`**. For each storefront area, say which endpoint replaces which local file or context:
  - `src/data/products.js` / `catalog.js` → products, categories, bootstrap
  - `src/data/configurator.js` + `utils/pricing.js` → configurator, configurator/price
  - `src/data/site.js` → bootstrap, home
  - `about.js`, `policies.js`, `testimonials.js` → about, pages, faqs, home
  - `context/AuthContext.jsx` → auth and me endpoints
  - `context/ShopContext.jsx` (cart stays local; prices from cart/quote; wishlist → wishlist endpoints; coupons → quote)
  - Checkout pages → checkout + Stripe Payment Element (steps become Shipping → Review → Pay; remove the UPI/Net Banking tabs)
  - Order success / account orders / track order → orders endpoints (tracking now requires login)
  - Contact and newsletter forms → contact, newsletter

  Include request/response examples.
- Do not build: B2B/wholesale, guest checkout, engraving, UPI/net banking/PayPal, customer-submitted reviews, multi-language, push sending.
- If something in this brief conflicts with the AdminLTE design or with Laravel conventions, choose the conventional option and record the decision in `docs/PROGRESS.md`. Do not stop to ask about small details.
