# AANI GEMAS – backend & admin panel

Laravel 12 + MySQL 8 backend for the AANI GEMAS fine-jewelry store, with a React 19 admin panel built on the **Metronic 9 (Tailwind 4 + KTUI) demo10** design. It is the single source of truth for catalog, Design-Your-Ring configurator, pricing (live gold rate, multi-currency), customers, orders, Stripe payments and all storefront content.

- **Web storefront API** – `/api/v1/web/*`
- **Mobile app API** – `/api/v1/mobile/*` (same controllers; mobile adds app-version info and Stripe PaymentSheet keys)
- **Admin API** – `/api/v1/admin/*` (session cookie, used by the admin SPA)
- **Stripe webhook** – `/api/v1/webhooks/stripe`
- **Admin panel** – `/admin`
- **API docs** – `/docs` (Scribe; Postman collection and OpenAPI spec in [`docs/api/`](docs/api))

Related docs: [`docs/BACKEND_BRIEF.md`](docs/BACKEND_BRIEF.md) (requirements), [`docs/PROGRESS.md`](docs/PROGRESS.md) (status, decisions, open questions), [`docs/STOREFRONT_INTEGRATION.md`](docs/STOREFRONT_INTEGRATION.md) (how the React storefront switches from local data to this API).

## Requirements

PHP 8.3+ (extensions: intl, mbstring, pdo_mysql, gd, zip, fileinfo), Composer 2, Node 20+, MySQL 8.

## Local setup

```bash
composer install
```

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
php artisan key:generate
```

Edit `.env` (database, `ADMIN_EMAIL` / `ADMIN_PASSWORD`, mail, Stripe test keys, Google client ids, `GOLD_API_KEY`), then:

```bash
php artisan migrate --seed
```

```bash
php artisan storage:link
```

```bash
npm run build
```

Run the app, the queue worker (all emails are queued) and the scheduler (gold/FX fetches, stale-order cleanup) in three terminals:

```bash
php artisan serve
```

```bash
php artisan queue:work
```

```bash
php artisan schedule:work
```

For admin UI development use `npm run dev` (Vite with hot reload) instead of `npm run build`.

The seeder loads everything from `database/seeders/data/storefront-seed.json`, copies `database/seeders/data/images` to the public disk, creates the roles, the Super Admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, the currencies (EUR base + USD, INR, AED, GBP with manual starter rates) and sets the gold source to **manual** at €2,480/oz. In `local`/`development` it also creates the demo customer `demo@aanigems.com` / `Demo@1234`. Re-running `php artisan db:seed` is safe (idempotent).

### First admin login

Open `/admin`, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Two-factor authentication is mandatory: scan the QR code with an authenticator app, confirm a code and store the recovery codes. Every later sign-in asks for a TOTP (or recovery) code. Sessions time out after `ADMIN_IDLE_MINUTES` (default 30) of inactivity.

Roles: **Super Admin** (everything), **Manager** (catalog, configurator, pricing, coupons, orders incl. refunds, customers, content, messages), **Support** (view orders, update stage and tracking, view customers, messages). The permission matrix is editable in *Staff & roles*.

## Stripe (test mode)

Use **test keys only** for now (`pk_test_…`, `sk_test_…`). Orders are marked paid **only by the webhook**. Forward webhooks locally with the Stripe CLI:

```bash
stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe
```

Copy the `whsec_…` secret it prints into `STRIPE_WEBHOOK_SECRET`. Events handled: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` (enable these three on the dashboard webhook endpoint in production).

Test cards (any future expiry, any CVC):

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | succeeds |
| `4000 0025 0000 3155` | requires 3-D Secure |
| `4000 0000 0000 9995` | declined |

Mobile PaymentSheet uses an ephemeral key created with Stripe API version `STRIPE_EPHEMERAL_KEY_VERSION` (default `2024-06-20`); keep it in line with the Stripe SDK version of the app.

### Currencies and Stripe

PaymentIntents are created in the **order's currency** (EUR, USD, INR, AED or GBP). All five are Stripe-supported charge currencies, but what actually works depends on the client's Stripe account, which could not be checked from here (no account keys). Before going live, please verify on the client's account:

- **Account country.** Settlement/payout currencies and conversion fees depend on it. If the account is registered in **India**, Stripe India has specific rules for international (non-INR) payments and for charging Indian-issued cards; these need to be enabled/confirmed with Stripe.
- **INR from a non-Indian account.** Charging Indian cards can see more declines and stricter 3-D Secure; run test and small live transactions.
- **Minimum charge amounts** per currency apply (roughly the equivalent of €0.50); not an issue at jewelry price points.

If a currency turns out to be unsupported, disable it in *Admin → Pricing → Currencies*; clients fall back to EUR automatically.

## Gold rate and exchange rates

- *Admin → Pricing → Gold rate*: the selected source (`manual` or `api`) is always the one used; there is no automatic switching. `api` can only be selected after a successful **Test & fetch now**. If the provider fails later, the last good API rate stays in use, the dashboard shows "API rate is X hours old", and staff get an email after more than 3 consecutive failures.
- Provider: GoldAPI.io (`GOLD_API_KEY`), behind the `App\Services\Rates\GoldRateProvider` interface. Mind the monthly request quota; the fetch interval is configurable (default 60 min). Fetches only run while the source is `api`.
- Exchange rates: same rules; default provider `https://open.er-api.com/v6/latest/EUR` (`FX_API_URL`, free, no key), interval default 720 min.

Manual run: `php artisan rates:gold --force`, `php artisan rates:fx --force`. Stale unpaid orders: `php artisan orders:cancel-stale` (hourly).

## Environment variables

| Variable | Purpose |
|---|---|
| `APP_URL`, `STOREFRONT_URL` | Backend URL; storefront URL used in email links (`{STOREFRONT_URL}/account/orders/{number}`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seeded Super Admin |
| `ADMIN_IDLE_MINUTES` | Admin session idle timeout |
| `DB_*` | MySQL connection |
| `MAIL_*`, `MAIL_ADMIN_NOTIFY` | SMTP (Mailtrap in dev); staff notification address (also editable in App settings) |
| `STRIPE_KEY`, `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_EPHEMERAL_KEY_VERSION` | Stripe (test mode) |
| `GOOGLE_CLIENT_ID_WEB`, `GOOGLE_CLIENT_ID_IOS`, `GOOGLE_CLIENT_ID_ANDROID` | Allowed audiences for Google ID tokens |
| `GOLD_API_KEY`, `FX_API_URL` | Rate providers |
| `SANCTUM_STATEFUL_DOMAINS` | Admin domain(s) |
| `CORS_ALLOWED_ORIGINS` | Storefront origins (comma-separated, e.g. `http://localhost:5173`) |
| `SANCTUM_TOKEN_EXPIRATION` | Customer token lifetime in minutes (default 43200 = 30 days) |

Secrets live only in `.env`; the admin shows only whether they are configured and whether Stripe is in test or live mode.

## Architecture

- `app/Services` – business logic: `PricingService` (configurator and totals formulas), `GoldRateService`, `CurrencyService`, `CartQuoteService`, `CouponService`, `CheckoutService`, `PaymentService`, `OrderService`; Stripe behind `Services/Stripe/StripeGateway`, Google behind `Services/Auth/GoogleTokenVerifier`.
- `app/Http/Controllers/Api` – web + mobile (shared; routes in `routes/api/shared*.php`, platform files `routes/api/web.php` / `mobile.php`).
- `app/Http/Controllers/Admin` – admin API (`routes/api/admin*.php`), every route behind `admin.auth` + `admin.2fa` + a permission.
- `resources/js/admin` – React admin SPA on Metronic demo10 (layout in `layout/AppLayout.jsx`, primitives in `components/`, screens in `pages/`).
- `resources/css/admin/metronic.css` – Tailwind 4 entry: Metronic theme tokens, KTUI components (`@keenthemes/ktui`), Metronic menu/scrollable/container components, keenicons (filled set) and the demo10 layout/animations. Compiled by Vite with `@tailwindcss/vite`, so any Tailwind utility used in the React files is generated. Source theme: `design admin lte/metronic-tailwind-html-demos/`.
- Money is stored as integer minor units (EUR); every API money value is `{amount, currency, formatted}`.

## Tests

```bash
php artisan test
```

Feature tests cover the pricing and totals formulas, gold/FX source rules, cart-quote rejections, checkout + Stripe (mocked) + webhook idempotency, retry/cancel/refund, customer auth (password, Google with a mock verifier, reset codes), account/addresses/wishlist, admin 2FA and per-role permissions, admin modules, CMS and email rendering. Tests use in-memory SQLite.

## API docs

`/docs` serves the Scribe documentation (groups: Web · …, Mobile · …, Admin · …, Webhooks). Regenerate after API changes:

```bash
php artisan scribe:generate
```

Then copy `storage/app/private/scribe/collection.json` and `openapi.yaml` to `docs/api/` to refresh the committed Postman collection and OpenAPI spec.
