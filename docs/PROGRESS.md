# AANI GEMAS backend: progress

Branch: `development`. Brief: `docs/BACKEND_BRIEF.md`.

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Laravel + React admin shell (AdminLTE), staff auth, mandatory 2FA, roles | ✅ done |
| 2 | Migrations, models, seeders (from `storefront-seed.json`) | ✅ done |
| 3 | Pricing, gold-rate, FX services + public store/content/configurator/quote APIs | ⏳ next |
| 4 | Customer auth (Google, reset code) + account, addresses, wishlist | ☐ |
| 5 | Checkout, Stripe PaymentIntents, webhooks, orders APIs, emails, scheduled jobs | ☐ |
| 6 | Admin: orders, customers, catalog, configurator, pricing, coupons | ☐ |
| 7 | Admin: CMS, messages, staff/roles, activity log, app settings | ☐ |
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

## Next
- M3: PricingService, GoldRateService, CurrencyService, CartQuoteService, CouponService + public store/content/configurator/quote APIs.

## Open questions
- Seeded copy still mentions "$" (e.g. "Free Shipping over $500", "Under $1000", policy text "prices are shown in US dollars") while the base currency is now EUR. Left as is per the brief ("leave everything else as it is"); editable in Content.
- The Services content still has an "Engraving" card and some product details say "Complimentary engraving". Engraving is not offered anywhere in the flows; the client may want to remove that copy in admin.
