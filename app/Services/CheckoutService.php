<?php

namespace App\Services;

use App\Models\Country;
use App\Models\IdempotencyKey;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CheckoutService
{
    public function __construct(
        private CartQuoteService $quotes,
        private CouponService $coupons,
        private OrderService $orders,
    ) {}

    /**
     * Re-quotes the cart, validates everything and creates a pending_payment
     * order with snapshots inside a transaction. Idempotent per Idempotency-Key.
     *
     * @return array{order: Order, replayed: bool}
     */
    public function placeOrder(User $user, array $data, string $platform, string $idempotencyKey): array
    {
        $hash = hash('sha256', json_encode([$data, $platform]));
        $existing = IdempotencyKey::where('user_id', $user->id)->where('key', $idempotencyKey)->first();
        if ($existing) {
            return $this->replay($existing, $hash);
        }

        $quote = $this->quotes->quote($data['items'], $data['coupon_code'] ?? null, $data['shipping_method'], $user);
        $this->assertQuoteIsValid($quote, $data);
        $ship = $this->resolveAddress($user, $data);

        try {
            $order = DB::transaction(function () use ($user, $data, $platform, $quote, $ship, $idempotencyKey, $hash) {
                $key = IdempotencyKey::create(['user_id' => $user->id, 'key' => $idempotencyKey, 'request_hash' => $hash]);

                if (! empty($data['save_address']) && empty($data['address_id'])) {
                    $isFirst = ! $user->addresses()->exists();
                    $user->addresses()->create($ship['fields'] + ['is_default' => $isFirst]);
                }

                $order = $this->createOrder($user, $platform, $quote, $ship, $data['customer_note'] ?? null);
                $key->forceFill(['order_id' => $order->id])->save();

                return $order;
            });
        } catch (UniqueConstraintViolationException) {
            // Concurrent request with the same key.
            return $this->replay(IdempotencyKey::where('user_id', $user->id)->where('key', $idempotencyKey)->firstOrFail(), $hash);
        }

        return ['order' => $order, 'replayed' => false];
    }

    private function replay(IdempotencyKey $key, string $hash): array
    {
        if ($key->request_hash !== $hash) {
            throw new HttpResponseException(response()->json([
                'message' => 'This Idempotency-Key was already used for a different checkout. Generate a new key.',
                'code' => 'idempotency_key_reused',
            ], 409));
        }
        $order = $key->order_id ? Order::find($key->order_id) : null;
        if (! $order) {
            throw new HttpResponseException(response()->json(['message' => 'The previous checkout attempt is still being processed.', 'code' => 'in_progress'], 409));
        }

        return ['order' => $order, 'replayed' => true];
    }

    private function assertQuoteIsValid(array $quote, array $data): void
    {
        $errors = [];
        foreach ($quote['lines'] as $line) {
            foreach ($line['errors'] as $err) {
                $errors["items.{$line['index']}"][] = match ($err) {
                    'out_of_stock' => ($line['name'] ?? 'This item').' is out of stock in the quantity requested.',
                    'invalid_size' => 'Please choose a valid size for '.($line['name'] ?? 'this item').'.',
                    'inactive' => ($line['name'] ?? 'This item').' is no longer available.',
                    'combo_unavailable' => 'This ring and stone combination is no longer available.',
                    default => 'This item is no longer available.',
                };
            }
        }
        if (! $quote['lines']) {
            $errors['items'][] = 'Your bag is empty.';
        }
        if ($quote['coupon'] && ! $quote['coupon']['valid']) {
            $errors['coupon_code'][] = $quote['coupon']['message'];
        }
        if ($quote['shipping_error'] || ! $quote['shipping_method']) {
            $errors['shipping_method'][] = 'Please choose a shipping method.';
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    /** @return array{fields: array, country_name: string} */
    private function resolveAddress(User $user, array $data): array
    {
        if (! empty($data['address_id'])) {
            $a = $user->addresses()->whereKey($data['address_id'])->first();
            if (! $a) {
                throw ValidationException::withMessages(['address_id' => 'Please choose one of your saved addresses.']);
            }
            $fields = $a->only(['label', 'name', 'phone', 'line1', 'city', 'state', 'zip', 'country_code']);
        } else {
            $fields = collect($data['address'])->only(['label', 'name', 'phone', 'line1', 'city', 'state', 'zip', 'country_code'])->all();
        }

        $country = Country::where('code', strtoupper($fields['country_code']))->where('is_active', true)->first();
        if (! $country) {
            throw ValidationException::withMessages([! empty($data['address_id']) ? 'address_id' : 'address.country_code' => 'We do not ship to this country yet.']);
        }

        return ['fields' => $fields, 'country_name' => $country->name];
    }

    private function createOrder(User $user, string $platform, array $quote, array $ship, ?string $note): Order
    {
        $t = $quote['totals'];
        $method = $quote['shipping_method'];
        $coupon = $quote['coupon']['model'] ?? null;
        $a = $ship['fields'];

        $order = Order::create($this->businessFields($user, $quote) + [
            'user_id' => $user->id,
            'email' => $user->email,
            'placed_from' => $platform,
            'currency' => $quote['currency'],
            'exchange_rate' => $quote['exchange_rate'],
            'subtotal' => $t['subtotal'],
            'discount' => $t['discount'],
            'shipping' => $t['shipping'],
            'tax' => $t['tax'],
            'tax_rate' => $t['tax_rate'],
            'total' => $t['total'],
            'total_eur' => (int) round($t['total'] / $quote['exchange_rate']),
            'coupon_code' => $coupon?->code,
            'coupon_snapshot' => $coupon ? $this->coupons->snapshot($coupon) : null,
            'shipping_method_code' => $method->code,
            'shipping_method_name' => $method->name,
            'shipping_delivery_time' => $method->delivery_time,
            'ship_name' => $a['name'],
            'ship_phone' => $a['phone'] ?? null,
            'ship_line1' => $a['line1'],
            'ship_city' => $a['city'],
            'ship_state' => $a['state'] ?? null,
            'ship_zip' => $a['zip'],
            'ship_country' => $ship['country_name'],
            'ship_country_code' => strtoupper($a['country_code']),
            'status' => 'pending_payment',
            'customer_note' => $note,
        ]);

        foreach ($quote['lines'] as $l) {
            $order->items()->create([
                'kind' => $l['type'],
                'product_id' => $l['type'] === 'product' ? $l['product']->id : null,
                'config_ring_id' => $l['type'] === 'custom_ring' ? $l['ring']->id : null,
                'config_stone_id' => $l['type'] === 'custom_ring' ? $l['stone']->id : null,
                'name' => $l['name'],
                'subtitle' => $l['subtitle'] ?? null,
                'image' => $l['image'] ?? null,
                'size' => $l['size'],
                'qty' => $l['qty'],
                'unit_price' => $l['unit_price'],
                'line_total' => $l['line_total'],
                'unit_price_eur' => $l['unit_price_eur'],
                'snapshot' => $l['snapshot'],
            ]);
        }

        $order->isBusiness()
            ? $this->orders->recordHistory($order, 'status', null, 'awaiting_approval', 'Business order created (cash on delivery), awaiting approval')
            : $this->orders->recordHistory($order, 'status', null, 'pending_payment', 'Order created');

        return $order;
    }

    /**
     * Business (B2B) orders: cash on delivery, awaiting staff approval, with a snapshot of the tier,
     * the sales person and the commission (rate × products total after the tier discount; no shipping/tax).
     */
    private function businessFields(User $user, array $quote): array
    {
        if (! $user->isBusiness()) {
            return [];
        }
        $profile = $user->businessProfile()->with(['tier', 'salesRep.salesRep'])->first();
        $rate = (float) ($profile?->salesRep?->salesRep?->commission_rate ?? 0);
        $base = $quote['totals']['subtotal'] - $quote['totals']['discount'];
        $baseEur = (int) collect($quote['lines'])->where('available', true)->sum(fn ($l) => $l['unit_price_eur'] * $l['qty']);
        $hasRep = $profile?->sales_rep_id !== null;

        return [
            'account_type' => 'business',
            'status' => 'awaiting_approval',
            'sales_rep_id' => $profile?->sales_rep_id,
            'b2b_tier_name' => $profile?->tier?->name,
            'company_name' => $profile?->company_name,
            'commission_rate' => $hasRep ? $rate : null,
            'commission_base' => $hasRep ? $base : null,
            'commission_amount' => $hasRep ? (int) round($base * $rate / 100) : null,
            'commission_amount_eur' => $hasRep ? (int) round($baseEur * $rate / 100) : null,
        ];
    }
}
