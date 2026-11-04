# Introduction

Web storefront, mobile app and admin APIs for AANI GEMAS.

<aside>
    <strong>Base URL</strong>: <code>http://localhost:8000</code>
</aside>

    AANI GEMAS backend API (v1). Groups are prefixed by platform:

    * **Web** – `/api/v1/web/*` (storefront)
    * **Mobile** – `/api/v1/mobile/*` (same behaviour as web, plus `app` in bootstrap, PaymentSheet keys at checkout and push-token endpoints)
    * **Admin** – `/api/v1/admin/*` (admin SPA, session cookie)
    * **Webhooks** – `/api/v1/webhooks/stripe`

    Conventions:

    * Money is always `{ "amount": 82137, "currency": "EUR", "formatted": "€821.37" }` (`amount` in minor units).
    * Send `X-Currency: EUR|USD|INR|AED|GBP` to get prices in that currency; `meta.currency` says which one was used.
    * Lists return `{ data, meta, links }` (`per_page` max 50). Validation errors return 422 `{ message, errors }` with user-friendly messages.
    * Customer endpoints use `Authorization: Bearer <token>` from register / login / Google.
    * The server prices everything: clients send only ids, qty, size and codes.

