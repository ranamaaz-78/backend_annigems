# AANI GEMAS backend: progress

Branch: `development`. Brief: `docs/BACKEND_BRIEF.md`.

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Laravel + React admin shell (AdminLTE), staff auth, mandatory 2FA, roles | ✅ done |
| 2 | Migrations, models, seeders (from `storefront-seed.json`) | ✅ done |
| 3 | Pricing, gold-rate, FX services + public store/content/configurator/quote APIs | ✅ done |
| 4 | Customer auth (Google, reset code) + account, addresses, wishlist | ✅ done |
| 5 | Checkout, Stripe PaymentIntents, webhooks, orders APIs, emails, scheduled jobs | ✅ done |
| 6 | Admin: orders, customers, catalog, configurator, pricing, coupons | ✅ done |
| 7 | Admin: CMS, messages, staff/roles, activity log, app settings | ⏳ next |
| 8 | Scribe docs, Postman export, tests green, README, storefront integration doc | ☐ |

## Done

### M1
- Laravel 12 skeleton, Sanctum, spatie/permission, spatie/activitylog, google2fa + bacon QR, stripe-php, php-jwt, dompdf, Scribe (dev).
- `admin` session guard + `admin_users` provider/broker; customers use Sanctum Bearer tokens (expiry `SANCTUM_TOKEN_EXPIRATION`, default 30 days).
- Route files: `routes/api/{web,mobile,admin,webhooks}.php` under `/api/v1/...`.
- Staff auth API: login, forced TOTP setup (QR + 8 recovery codes), challenge (TOTP or recovery code), logout, forgot/reset password (email link), profile, regenerate recovery codes. Server-side idle timeout (`ADMIN_IDLE_MINUTES`, default 30) plus a client idle timer.
- Roles seeded: Super Admin (all, via `Gate::before`), Manager, Support (`app/Support/Permissions.php`).
- React 19 + Vite + React Router admin SPA in `resources/js/admin`, served at `/admin/*`. AdminLTE 4 CSS copied from the design folder (`resources/css/admin/adminlte.min.css`); header, sidebar (treeview), content header + breadcrumbs, cards, small boxes, callouts, badges, modal, server-side `DataTable`, and form helpers ported as React components (no jQuery/Bootstrap JS).

### M2
- Migrations for every table in brief §3 (customers, staff, catalog, configurator, settings, gold/FX, shipping, countries, coupons, orders + items + history + notes, stripe_events, order_stages, wishlists, contact/newsletter, CMS, devices, idempotency keys). Money columns are `BIGINT UNSIGNED` minor units.
- Eloquent models with casts; admin-managed models log changes to the activity log (`LogsChanges` trait).
- `StorefrontSeeder` loads everything from `database/seeders/data/storefront-seed.json` (idempotent, re-runnable) and copies `database/seeders/data/images` to the public disk (`storage/app/public/images`). `CurrencySeeder` adds EUR/USD/INR/AED/GBP with manual starter rates and the initial manual gold rate (€2,480/oz). `DemoCustomerSeeder` (local/dev/testing only): `demo@aanigems.com` / `Demo@1234`.

### M3
- Services: `PricingService` (configurator formula + totals formula), `GoldRateService` (+ `GoldRateProvider` interface, GoldAPI.io driver), `CurrencyService` (+ `ExchangeRateProvider`, open.er-api.com driver, money formatting), `CouponService`, `CartQuoteService`.
- Gold/FX rules: the selected source is always the one used (no automatic switching); last good API rate kept on failure; switching to `api` requires a successful fetch; staff email after more than 3 consecutive gold API failures; stale/failure warning in `status()`.
- Scheduler: `rates:gold` and `rates:fx` run every minute and fetch only when the source is `api` and the configured interval elapsed (protects the GoldAPI quota). `--force` fetches now.
- Public API (`/api/v1/web/*` and `/api/v1/mobile/*`, shared routes in `routes/api/shared.php`): bootstrap (mobile adds `app`), home, categories, products (filters/sort/pagination), product detail by slug or legacy id, search, configurator, configurator/price, cart/quote, pages, faqs, about, services, contact, newsletter.
- `X-Currency` header resolved by middleware; every JSON response gets `meta.currency`.
- Tests: pricing formula (brief example €821.36, karat purity, conversion), totals (coupon, threshold on taxable, tax), gold/FX source rules, quote rejections, store endpoints.

### M4
- Customer auth: register, login (exact brief error messages), Google ID-token sign-in (`GoogleTokenVerifier` interface; `GoogleJwtVerifier` checks Google JWKS, issuer and audience), forgot password → 6-digit code (15 min, max 5 attempts) → verify → reset (revokes all tokens, "password changed" email), logout, logout-all. Rate-limited.
- Tokens: Sanctum personal access tokens named `{platform}:{device_name}` with ability `platform:{web|mobile}` and an explicit expiry (`SANCTUM_TOKEN_EXPIRATION`, 30 days). Mobile requires `device_name`.
- Account: profile get/update, change password (Google-only users may set a first password without `current_password`), delete account (password confirmation when set; anonymises, soft-deletes, removes addresses/wishlist/devices, revokes tokens; orders kept).
- Addresses CRUD with a single default (first address becomes default; deleting the default promotes the oldest). Countries must be active shipping countries.
- Wishlist: list/add/remove/sync; ids may be numeric or storefront legacy ids (`r1`) so the local wishlist can be merged as-is.
- Mobile-only: `POST/DELETE /api/v1/mobile/devices` (push tokens stored only).
- Emails (queued, branded Blade layout): welcome, password reset code, password changed.

### M5
- `POST {p}/checkout` (requires `Idempotency-Key`): re-quotes, validates stock/sizes/combos/coupon/shipping/address (saved `address_id` or inline `address` + `save_address`), creates the `pending_payment` order + items + snapshots in one transaction, then creates/reuses the Stripe Customer and a card-only PaymentIntent in the order currency. Web payload: `client_secret`, `publishable_key`; mobile adds `customer_id`, `ephemeral_key` (PaymentSheet).
- Stripe is behind a `StripeGateway` interface (`StripeClientGateway` in production, a fake in tests).
- Webhook `POST /api/v1/webhooks/stripe`: signature verified, idempotent via `stripe_events`; `payment_intent.succeeded` → paid/placed, stock decrement (flags `stock_issue` instead of failing), coupon `used_count` +1, history, "order confirmed" + staff "new paid order" emails; `payment_intent.payment_failed` → `payment_failed` + email with retry link; `charge.refunded` → `refunded_amount`, `refunded`/`partially_refunded` + email. `markPaid` is also idempotent per order (row lock), so different events for the same PI cannot double-count.
- Orders API: list, detail (items, totals, five-stage timeline with labels/descriptions from `order_stages`, history, tracking), retry payment (re-validates availability, reuses a still-usable PI, prices stay snapshotted), cancel (unpaid only, cancels the PI), reorder (cart lines for still-available items).
- `OrderService` also contains the admin stage machine (forward one step, back one step with a note, `shipped` requires carrier + tracking number, optional customer email) used in M6.
- Emails (queued): order confirmed (items, custom-ring breakdown, totals), payment failed, stage updates (crafting / quality check / shipped with tracking / delivered), order cancelled, refund issued; staff: new paid order, new contact message, gold API failing.
- Scheduler: `orders:cancel-stale` hourly (pending orders older than `orders.pending_ttl_hours`).

### M6
- Admin API (`routes/api/admin_modules.php`, every route permission-checked): dashboard stats, orders (filters: status, stage, date range, currency, platform, search; CSV export; detail; stage forward/back with tracking + "notify customer"; tracking edit; cancel unpaid; full/partial Stripe refund; resend confirmation; internal notes; printable invoice and packing slip HTML views), customers (search, detail with addresses/orders/wishlist/LTV/devices, activate/deactivate, send reset code), products (CRUD, ordered gallery, details/tags, sizes, badge, featured/new flags + order, stock), categories, reviews, configurator rings/stones (new rings/stones get inactive combo rows), combos matrix (toggle + image), price preview (EUR + every active currency), gold rate (status, history, source switch with the test-first rule, manual rate, interval, fetch now), currencies (enable/disable, manual rates, FX source, fetch now), tax / free-shipping threshold / pending-order TTL, shipping methods, countries, coupons (with usage stats), media upload.
- React screens for all of the above in the AdminLTE layout: KPI small boxes + revenue bar chart + gold/FX widgets on the dashboard, server-side `DataTable` lists, a schema-driven `CrudPage` for simple resources, a full product form with multi-image upload and drag-and-drop ordering, live gem swatch preview for stones, the rings × stones matrix, and a gold-rate history chart.
- Fixed: the SPA now sends the `XSRF-TOKEN` cookie (not the page `<meta>` token), because Laravel rotates the CSRF token when the session is regenerated at login/2FA.
- Tests: role permissions (Support/Manager/Super Admin), 2FA enforcement, idle timeout, order stage machine + refund + documents + CSV, customers, catalog CRUD with images, configurator admin, pricing admin.

## Decisions

- **Laravel 12** pinned as the brief says, although Laravel 13 is the current release (ecosystem packages such as Scribe and spatie are proven on 12).
- **Admin auth uses the plain session guard behind the `web` middleware group** (session cookie + CSRF/XSRF cookie) rather than Sanctum's stateful mode. That is exactly what Sanctum SPA auth does under the hood, but it keeps the staff guard completely separate from customer tokens: Sanctum's `guard` config is empty so `auth:sanctum` only accepts customer Bearer tokens.
- **Local dev in this container uses SQLite** (no MySQL server available here); the schema is written for MySQL 8 and `.env.example` targets MySQL. Tests run on in-memory SQLite.
- Admin 2FA state lives in the session (`admin_2fa_passed`); every new login requires the TOTP challenge.

- Image paths are stored relative to the public disk (`images/ring1_plain.jpg`); APIs return absolute URLs (`APP_URL/storage/images/...`). Run `php artisan storage:link`.
- Seeded products: `has_sizes = true` for the rings category (sizes = the seed's `catalog.ringSizes`); `stock_qty = 10` when the storefront says `inStock`, else 0 (the storefront has no stock numbers). `legacy_id` keeps `r1`, `n1`… and `slug` is generated from the name.
- Size chart / guide steps / configurator step labels are stored as **content blocks** (`configurator.*`) so the CMS edits them; the brief lists them both as settings and content blocks, and one storage place avoids drift.
- Order numbers: `AG-` + (10000 + order id), so the first order is `AG-10001`.
- Order stage `quality` from the seed is stored as `quality_check` (the brief's stage code).
- Storefront country "Other" is not seeded (not a real country); India, US, UK, UAE + 15 EU countries are.
- Stone `carat` is parsed from the seed description ("1.2 carats"), display only.

- **Currency conversion of composite prices**: each component (gold value, craft fee, stone) is converted first and summed in the target currency, so the configurator breakdown and the cart always add up. Product unit prices are converted, then multiplied by qty.
- `min_price` / `max_price` product filters are **minor units of the request currency** (same unit as every money `amount`), compared in EUR.
- Quote lines with errors are excluded from totals; `valid` tells the client whether checkout can proceed. Stock is checked against the summed qty of the same product across lines.
- `cart/quote` is public; when a Bearer token is sent the per-customer coupon limit is also checked.
- Coupon `min_subtotal` is compared against the EUR subtotal (it is an EUR amount).
- `total_eur` of an order will be `round(total / exchange_rate)` (reporting value).

- Google sign-in on **mobile** accepts the iOS, Android **and web** client ids as audience (Android native sign-in commonly issues tokens for the web/server client id); web accepts only the web client id.
- Linking Google to an existing password account requires `email_verified = true` in the Google token.
- Changing the password from the account screen keeps the current token and revokes the others; the reset-code flow revokes all.
- A deactivated or deleted customer's Bearer token is rejected (`401`, `code: account_disabled`).

- Idempotency: the same key + same body returns the same order (200) with a fresh/reused payment payload; the same key with a different body returns `409`.
- If Stripe is unreachable during checkout the order is still created (`pending_payment`) and the API returns `502`; the client can call `/orders/{number}/pay` to retry.
- If a `payment_intent.succeeded` arrives for an order that was already cancelled (race with the stale-order job), the order is still marked paid (money was taken) and the history note asks staff to review.
- Stale unpaid orders get the "order cancelled" email (reason: payment not completed in time).
- Mobile ephemeral keys use Stripe API version `STRIPE_EPHEMERAL_KEY_VERSION` (default `2024-06-20`); it must match the mobile Stripe SDK.

- Admin money inputs and lists are in EUR minor units (the base currency); order screens show the order currency plus the EUR total.
- Refund amounts are entered in the order currency; the order status changes only when Stripe's `charge.refunded` webhook arrives (a note records the request immediately).
- Invoice / packing slip are HTML print views (browser "Save as PDF"), so no PDF engine is needed at runtime; dompdf is installed if a PDF download is wanted later.
- Deleting a category with products is blocked; products are soft-deleted (orders keep their snapshots).

## Next
- M7: content blocks (structured forms), policy pages, FAQs, testimonials, contact topics, size guide editor, messages inbox + newsletter, staff & roles, activity log, app settings.

## Open questions
- Seeded copy still mentions "$" (e.g. "Free Shipping over $500", "Under $1000", policy text "prices are shown in US dollars") while the base currency is now EUR. Left as is per the brief ("leave everything else as it is"); editable in Content.
- The Services content still has an "Engraving" card and some product details say "Complimentary engraving". Engraving is not offered anywhere in the flows; the client may want to remove that copy in admin.
