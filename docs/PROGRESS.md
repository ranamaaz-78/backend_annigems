# AANI GEMAS backend: progress

Branch: `development`. Brief: `docs/BACKEND_BRIEF.md`.

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Laravel + React admin shell (AdminLTE), staff auth, mandatory 2FA, roles | ✅ done |
| 2 | Migrations, models, seeders (from `storefront-seed.json`) | ⏳ next |
| 3 | Pricing, gold-rate, FX services + public store/content/configurator/quote APIs | ☐ |
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

## Decisions

- **Laravel 12** pinned as the brief says, although Laravel 13 is the current release (ecosystem packages such as Scribe and spatie are proven on 12).
- **Admin auth uses the plain session guard behind the `web` middleware group** (session cookie + CSRF/XSRF cookie) rather than Sanctum's stateful mode. That is exactly what Sanctum SPA auth does under the hood, but it keeps the staff guard completely separate from customer tokens: Sanctum's `guard` config is empty so `auth:sanctum` only accepts customer Bearer tokens.
- **Local dev in this container uses SQLite** (no MySQL server available here); the schema is written for MySQL 8 and `.env.example` targets MySQL. Tests run on in-memory SQLite.
- Admin 2FA state lives in the session (`admin_2fa_passed`); every new login requires the TOTP challenge.

## Next
- M2: all tables from brief §3 and seeders from `database/seeders/data/storefront-seed.json`.

## Open questions
- None blocking.
