# Storefront integration guide (web_annigems → AANI GEMAS API)

This document tells the storefront team which API endpoint replaces each local data file or context in `web_annigems`. After the switch, the storefront holds **no prices, content or catalog data** of its own: it only renders what the API returns. The mobile app uses the same endpoints under `/api/v1/mobile/*`.

Full reference (every field, every endpoint, "try it out"): `/docs` on the backend, or the Postman collection in [`docs/api/postman_collection.json`](api/postman_collection.json).

## 0. Basics

**Base URL:** `{API}/api/v1/web` (e.g. `http://localhost:8000/api/v1/web`). Add the storefront origin to `CORS_ALLOWED_ORIGINS` on the backend.

**Headers on every request**

```
Accept: application/json
Content-Type: application/json
X-Currency: EUR            # EUR | USD | INR | AED | GBP (unknown/disabled → EUR)
Authorization: Bearer …    # only for 🔒 endpoints
```

**Money**: every price is an object. Show `formatted`; use `amount` (minor units) only for maths you display yourself (never send it back).

```json
{ "amount": 82136, "currency": "EUR", "formatted": "€821.36" }
```

**Currency switcher**: keep the selected code in `localStorage`, send it as `X-Currency`, and re-fetch (or re-quote) when it changes. Every JSON response has `meta.currency` with the currency actually used.

**Lists**: `{ data, meta: {current_page, last_page, per_page, total}, links }`. `per_page` max 50.

**Errors**: validation → `422 { message, errors: { field: ["User-friendly message"] } }`; show the messages as they are. `401` → token missing/expired/disabled (sign the user out locally). `404` → `{ message }`.

**Images**: all image fields are absolute URLs. Remove `public/images` from the storefront once integrated.

**Ids**: products keep their old ids as `legacy_id` (`r1`, `n1`…). `/products/{slugOrLegacyId}` accepts both, so old links like `/product/r1` keep working. New links should use the `slug`. Cart lines must send the numeric `product_id`.

Suggested helper:

```js
export async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/web${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Currency': localStorage.getItem('currency') || 'EUR',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.message), { status: res.status, errors: json.errors, data: json });
  return json;
}
```

---

## 1. `src/data/products.js` / `catalog.js` → products, categories, bootstrap

| Old | New |
|---|---|
| `products` array | `GET /products` (filters + pagination), `GET /products/{slugOrLegacyId}` |
| `categories` (with hard-coded `count`) | `GET /categories` (count computed from active products) |
| `stoneFilters`, `sortOptions`, `maxPriceFilter`, `badges` | `GET /bootstrap` → `catalog` |
| `ratingDistribution`, product reviews | included in `GET /products/{id}` (`rating_distribution`, `reviews`) |
| Quick search | `GET /search?q=` (max 8) |

Shop page query params map 1:1: `?cat=rings` → `category=rings`, `sort=price-asc|price-desc|rating|newest|featured`, stone checkboxes → `stone[]=Ruby&stone[]=Diamond`, price slider → `min_price` / `max_price` **in minor units of the current currency** (the slider max is `bootstrap.catalog.max_price.amount`), plus `search`, `featured=1`, `new=1`, `in_stock=1`, `page`, `per_page`.

```http
GET /api/v1/web/products?category=rings&stone[]=Ruby&max_price=200000&sort=price-asc&per_page=12
```

```json
{
  "data": [
    {
      "id": 3, "legacy_id": "r3", "slug": "celeste-ruby-solitaire",
      "name": "Celeste Ruby Solitaire", "subtitle": "Aurora Setting with Burmese Ruby",
      "category": { "id": 1, "slug": "rings", "name": "Rings" },
      "price": { "amount": 124900, "currency": "EUR", "formatted": "€1,249.00" },
      "compare_at_price": null, "on_sale": false, "badge": "New",
      "image": "http://api.example/storage/images/ring1_ruby.jpg",
      "metal": "18K Gold", "stone": "Burmese Ruby 1.2ct", "weight": "3.2g",
      "rating": 5, "reviews_count": 47, "in_stock": true, "has_sizes": true,
      "is_customizable": false, "is_featured": false, "is_new_arrival": true, "tags": ["ruby", "red", "solitaire"]
    }
  ],
  "links": { "first": "…", "last": "…", "prev": null, "next": null },
  "meta": { "current_page": 1, "last_page": 1, "per_page": 12, "total": 1, "currency": "EUR" }
}
```

Product page: `GET /products/r1` returns the list fields plus `gallery` (first = main image), `sizes` (only when `has_sizes`), `description`, `details`, `related` (4, same category), `reviews` (product-specific first, then generic), `rating_distribution`, `shipping_points`, `care_instructions`. Field renames: `originalPrice` → `compare_at_price`, `reviews` (count) → `reviews_count`, `inStock` → `in_stock`, `customizable` → `is_customizable`.

**Size is required** for products with `has_sizes: true` (rings): disable "Add to bag" until a size is chosen; the quote rejects the line otherwise.

## 2. `src/data/configurator.js` + `utils/pricing.js` → configurator, configurator/price

Delete `utils/pricing.js`: the gold formula now lives only on the server.

`GET /configurator` returns `steps`, `rings` (each with `karat`, `metal`, `sizes`, `ring_charge`, `image`, `delivery_text`), `stones` (`price`, `color`, `glow`, `gem_style`, `uses_diamond_animation`, `rarity`, `carat`), `combos` (`[{ring_id, stone_id, image}]` – **only offer a stone for a ring if the pair is in `combos`**, and use the combo image for the preview), `size_chart`, `size_guide_steps` and `gold_rate`. Flow stays: choose ring → size (from `ring.sizes`) → stone (filtered by combos) → preview → add to cart. The customer never picks metal or karat (they come with the ring). There is no engraving.

When ring + size + stone are chosen (and whenever the currency changes):

```http
POST /api/v1/web/configurator/price
X-Currency: USD

{ "ring_id": 1, "stone_id": 1, "size": "6.5" }
```

```json
{
  "data": {
    "size": "6.5",
    "image": "http://api.example/storage/images/ring1_ruby.jpg",
    "karat": 18, "purity": 0.75, "gold_weight_g": 3.2,
    "gold_value": { "amount": 20667, "currency": "USD", "formatted": "$206.67" },
    "craft_fee": { "amount": 19440, "currency": "USD", "formatted": "$194.40" },
    "ring_charge": { "amount": 40107, "currency": "USD", "formatted": "$401.07" },
    "stone_price": { "amount": 48600, "currency": "USD", "formatted": "$486.00" },
    "total": { "amount": 88707, "currency": "USD", "formatted": "$887.07" },
    "total_eur": { "amount": 82136, "currency": "EUR", "formatted": "€821.36" },
    "delivery_text": "4-6 weeks",
    "gold_rate": {
      "per_oz": { "amount": 267840, "currency": "USD", "formatted": "$2,678.40" },
      "per_oz_eur": { "amount": 248000, "currency": "EUR", "formatted": "€2,480.00" },
      "source": "manual", "updated_at": "2026-11-04T09:50:27+00:00"
    }
  },
  "meta": { "currency": "USD" }
}
```

Show "Gold: {gold_rate.per_oz.formatted}/oz". Ring size never changes the price. Add to cart as `{ "type": "custom_ring", "ring_id": 1, "stone_id": 1, "size": "6.5", "qty": 1 }`.

## 3. `src/data/site.js` → bootstrap, home

Call `GET /bootstrap` once on app start (cache it in context). It contains: `brand`, `navigation.mega_menu`, `navigation.mobile`, `footer.columns`, `footer.legal_links`, `contact`, `contact_topics`, `trust_points`, `payment_badges` (now `["VISA","MC","AMEX"]`), `currencies` (active, with rates), `default_currency`, `tax_rate`, `free_shipping_threshold`, `shipping_methods`, `countries` (`[{code, name}]` – use `code` in addresses), `order_stages`, `catalog` (sort options, stone filters, max price, badges), `stripe_publishable_key`, `google_client_id`, `gold_rate`.

Navigation still contains the `/wholesale` and `/b2b/login` links (B2B is a later phase); hide them in the UI for now if wanted.

`GET /home` replaces the home sections: `hero` (`{since}` in `eyebrow` → `brand.since`), `usp_items`, `category_section` + `categories` (with counts), `featured_products`, `new_arrivals`, `design_ring_banner`, `testimonials_section` + `testimonials`.

## 4. `about.js`, `policies.js`, `testimonials.js` → about, pages, faqs, home

| Old | New |
|---|---|
| `about.js` | `GET /about` → `{story, stats, values, milestones}` |
| services list | `GET /services` |
| `policies.js` (`shipping-policy`, `returns`, `privacy-policy`, `terms`, `warranty`) | `GET /pages/{slug}` → `{slug, title, eyebrow, intro, updated, sections: [{id, heading, body: [paragraph…]}]}` |
| FAQ data | `GET /faqs` → `[{category, items: [{id, q, a}]}]` |
| `testimonials.js` | `GET /home` → `testimonials` (`product` = product label) |

## 5. `context/AuthContext.jsx` → auth and me endpoints

Store the token (`data.token`) in `localStorage` and send it as `Authorization: Bearer`. Tokens expire after 30 days (`expires_at`); on any `401` clear it and show the login page.

| Action | Endpoint |
|---|---|
| Register (`first_name`, `last_name`, `email`, `password`, `password_confirmation`, `terms`) | `POST /auth/register` |
| Login | `POST /auth/login` |
| Continue with Google (Google Identity Services ID token, client id from `bootstrap.google_client_id`) | `POST /auth/google` `{id_token}` |
| Forgot password → 6-digit code by email | `POST /auth/forgot-password` `{email}` |
| (optional) check the code | `POST /auth/verify-reset-code` `{email, code}` |
| Set new password | `POST /auth/reset-password` `{email, code, password, password_confirmation}` |
| Logout / logout all devices 🔒 | `POST /auth/logout`, `POST /auth/logout-all` |
| Profile 🔒 | `GET /me`, `PUT /me` `{first_name, last_name, phone, preferred_currency}` |
| Change password 🔒 | `PUT /me/password` `{current_password, password, password_confirmation}` (`current_password` not needed when `has_password` is false) |
| Delete account 🔒 | `DELETE /me` `{password}` |
| Addresses 🔒 | `GET/POST /me/addresses`, `PUT/DELETE /me/addresses/{id}`, `POST /me/addresses/{id}/default` |

```http
POST /api/v1/web/auth/login
{ "email": "demo@aanigems.com", "password": "Demo@1234" }
```

```json
{
  "data": {
    "user": {
      "id": 1, "first_name": "Demo", "last_name": "Customer", "name": "Demo Customer",
      "email": "demo@aanigems.com", "phone": null, "avatar_url": null, "preferred_currency": null,
      "account_type": "customer", "has_password": true, "google_linked": false, "created_at": "2026-11-04T09:50:26+00:00"
    },
    "token": "3|mJ0n…", "token_type": "Bearer", "expires_at": "2026-12-04T10:00:00+00:00"
  }
}
```

Login errors come back as 422 with the storefront's messages, e.g. `errors.email: ["No account found with this email."]`, `errors.password: ["Incorrect password. Please try again."]`, `errors.email: ["This account uses Google. Please continue with Google."]`.

Address shape: `{label, name, phone, line1, city, state, zip, country_code}` (`country_code` from `bootstrap.countries`).

## 6. `context/ShopContext.jsx` – cart stays local, prices from cart/quote

- **Cart**: keep it in `localStorage`, but store only `{type, product_id, size, qty}` / `{type, ring_id, stone_id, size, qty}` – no names or prices. Guests can add to the cart.
- **Prices**: call `POST /cart/quote` on the cart page, the checkout page, after every cart change and on currency change. Render lines, totals and shipping options from the response. Lines with `available: false` show their `errors` (`out_of_stock`, `inactive`, `invalid_size`, `combo_unavailable`, `not_found`) and are excluded from totals; block checkout while `valid` is false.
- **Coupons**: send `coupon_code` in the quote; show `coupon.message` (error or label). Remove the local coupon list.
- **Free-shipping banner**: `amount_to_free_shipping`.
- **Wishlist**: guests keep a local list; after login call `POST /wishlist/sync {product_ids: [...]}` (legacy ids like `"r1"` are accepted) and then use `GET /wishlist`, `POST /wishlist/{id}`, `DELETE /wishlist/{id}`.

```http
POST /api/v1/web/cart/quote
{
  "items": [
    { "type": "product", "product_id": 1, "qty": 1, "size": "7" },
    { "type": "custom_ring", "ring_id": 1, "stone_id": 1, "size": "6.5", "qty": 1 },
    { "type": "product", "product_id": 6, "qty": 1, "size": "7" }
  ],
  "coupon_code": "AANI10",
  "shipping_method": "standard"
}
```

```json
{
  "data": {
    "currency": "EUR",
    "valid": false,
    "lines": [
      { "index": 0, "type": "product", "product_id": 1, "legacy_id": "r1", "name": "Aurora Solitaire", "size": "7", "qty": 1,
        "unit_price": { "amount": 79900, "currency": "EUR", "formatted": "€799.00" },
        "line_total": { "amount": 79900, "currency": "EUR", "formatted": "€799.00" }, "available": true, "errors": [] },
      { "index": 1, "type": "custom_ring", "ring_id": 1, "stone_id": 1, "name": "Aurora Solitaire with Burmese Ruby",
        "subtitle": "18K Yellow Gold · 4-Prong Cathedral", "size": "6.5", "qty": 1,
        "unit_price": { "amount": 82136, "currency": "EUR", "formatted": "€821.36" },
        "line_total": { "amount": 82136, "currency": "EUR", "formatted": "€821.36" },
        "breakdown": { "gold_value": { "formatted": "€191.36" }, "craft_fee": { "formatted": "€180.00" }, "stone_price": { "formatted": "€450.00" }, "delivery_text": "4-6 weeks" },
        "available": true, "errors": [] },
      { "index": 2, "type": "product", "product_id": 6, "legacy_id": "r6", "name": "Foret Emerald Halo", "available": false, "errors": ["out_of_stock"] }
    ],
    "coupon": { "code": "AANI10", "valid": true, "message": "10% off your order", "type": "percent", "percent": 10,
      "discount": { "amount": 16204, "currency": "EUR", "formatted": "€162.04" } },
    "shipping_options": [
      { "code": "standard", "name": "Standard Delivery", "delivery_time": "5-7 business days", "price": { "amount": 0, "formatted": "€0.00" }, "is_free": true, "selected": true },
      { "code": "express", "name": "Express Delivery", "delivery_time": "2-3 business days", "price": { "amount": 4500, "formatted": "€45.00" }, "is_free": false, "selected": false }
    ],
    "free_shipping_threshold": { "amount": 50000, "currency": "EUR", "formatted": "€500.00" },
    "amount_to_free_shipping": { "amount": 0, "currency": "EUR", "formatted": "€0.00" },
    "totals": {
      "subtotal": { "amount": 162036, "formatted": "€1,620.36" },
      "discount": { "amount": 16204, "formatted": "€162.04" },
      "shipping": { "amount": 0, "formatted": "€0.00" },
      "tax_rate": 0.08,
      "tax": { "amount": 11667, "formatted": "€116.67" },
      "total": { "amount": 157499, "formatted": "€1,574.99" }
    },
    "gold_rate": { "per_oz": { "formatted": "€2,480.00" }, "source": "manual", "updated_at": "…" }
  },
  "meta": { "currency": "EUR" }
}
```

(Money objects shortened above; every one has `amount`, `currency`, `formatted`.)

## 7. Checkout pages → checkout + Stripe Payment Element

Login is required at checkout (no guest checkout). The steps become **Shipping → Review → Pay**. Remove the UPI / Net Banking / PayPal tabs: payment is **card only** through Stripe.

1. **Shipping**: pick a saved address (`GET /me/addresses`) or enter one (country select from `bootstrap.countries`), pick a shipping method from the quote's `shipping_options`.
2. **Review**: re-quote with `shipping_method` + `coupon_code` and show the totals.
3. **Pay**: create the order, then mount the Stripe Payment Element.

```http
POST /api/v1/web/checkout
Authorization: Bearer 3|mJ0n…
Idempotency-Key: 6f1c2b8e-3d4a-4c6f-9a1b-2e3f4a5b6c7d     # new UUID per checkout attempt; reuse it on network retries

{
  "items": [ { "type": "product", "product_id": 1, "qty": 1, "size": "7" } ],
  "address_id": 1,
  "shipping_method": "express",
  "coupon_code": "AANI10",
  "customer_note": "Gift wrap please"
}
```

Inline address instead of `address_id`: `"address": { "name": "…", "phone": "…", "line1": "…", "city": "…", "state": "…", "zip": "…", "country_code": "IN" }, "save_address": true`.

```json
{
  "data": {
    "order": {
      "number": "AG-10003", "status": "pending_payment", "stage": null, "currency": "EUR",
      "total": { "amount": 82163, "currency": "EUR", "formatted": "€821.63" },
      "items": [ … ], "totals": { … }, "shipping_address": { … }, "timeline": [ … ]
    },
    "payment": {
      "provider": "stripe",
      "payment_intent_id": "pi_3Q…",
      "client_secret": "pi_3Q…_secret_…",
      "publishable_key": "pk_test_…"
    }
  }
}
```

Validation problems (stock, size, combo, coupon, address) come back as 422, e.g. `errors["items.0"]: ["Please choose a valid size for Aurora Solitaire."]`.

```js
const stripe = await loadStripe(payment.publishable_key);
const elements = stripe.elements({ clientSecret: payment.client_secret });
elements.create('payment').mount('#payment-element');
// on submit:
const { error } = await stripe.confirmPayment({
  elements,
  confirmParams: { return_url: `${location.origin}/order-success/${order.number}` },
});
```

The order is marked **paid only by the Stripe webhook**. On the success page poll `GET /orders/{number}` every 2 s (stop after ~60 s) until `status` is `paid` or `payment_failed`. Show "Payment failed" with a **Retry** button that calls `POST /orders/{number}/pay` (same response shape as checkout; prices stay as originally quoted) and re-mounts the Payment Element. Clear the local cart once the order is created.

## 8. Order success / account orders / track order → orders endpoints

| Page | Endpoint |
|---|---|
| Order success | `GET /orders/{number}` (poll as above) |
| My orders | `GET /orders` (paginated, newest first) |
| Order detail / **Track order** | `GET /orders/{number}` → `status`, `stage`, `timeline` (5 stages with `label`, `description`, `done`, `current`, `at`), `tracking` (`carrier`, `number`, `url`) |
| Retry payment | `POST /orders/{number}/pay` |
| Cancel unpaid order | `POST /orders/{number}/cancel` (only `pending_payment` / `payment_failed`; `can_cancel` tells you) |
| Buy again | `POST /orders/{number}/reorder` → `{items: [cart lines], unavailable: [names]}` – put `items` in the local cart and re-quote |

**Tracking now requires login**: the "order number + email" track form is replaced by the signed-in order page (`/account/orders/{number}`, which is also the link in every email). Status values: `pending_payment`, `paid`, `payment_failed`, `cancelled`, `refunded`, `partially_refunded`. Stage values (paid orders): `placed`, `crafting`, `quality_check`, `shipped`, `delivered`.

## 9. Contact and newsletter forms

```http
POST /api/v1/web/contact
{ "name": "Priya Mehta", "email": "priya@example.com", "topic": "Order enquiry", "message": "Hello…" }
→ 201 { "message": "Thank you! Our team will get back to you within one business day.", "data": { "id": 12 } }

POST /api/v1/web/newsletter
{ "email": "priya@example.com" }
→ 201 { "message": "Thank you for subscribing!" }   (200 "You are already subscribed. Thank you!")
```

`topic` must be one of `bootstrap.contact_topics`. Both endpoints are rate-limited (429 when abused).

## 10. Clean-up checklist

- Delete `src/data/*.js` and `utils/pricing.js`; remove `public/images` (served by the API now).
- Remove cart/auth/orders logic from `localStorage` except: token, selected currency, cart lines (ids/size/qty only), guest wishlist ids.
- Remove UPI / Net Banking / PayPal UI; payment badges come from `bootstrap.payment_badges`.
- Remove engraving options anywhere in the UI.
- Add `@stripe/stripe-js` + `@stripe/react-stripe-js` and Google Identity Services.
- `.env`: `VITE_API_URL=http://localhost:8000`.
