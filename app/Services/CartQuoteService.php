<?php

namespace App\Services;

use App\Models\ConfigRingStone;
use App\Models\Product;
use App\Models\ShippingMethod;
use App\Models\User;
use App\Support\Media;
use Illuminate\Support\Collection;

/**
 * Prices a client-side cart. Clients send only ids, qty, size and codes;
 * every price comes from the server.
 *
 * Line error codes: not_found, inactive, out_of_stock, invalid_size, combo_unavailable.
 */
class CartQuoteService
{
    public function __construct(
        private PricingService $pricing,
        private CurrencyService $currency,
        private GoldRateService $gold,
        private CouponService $coupons,
        private B2bPricingService $b2b,
    ) {}

    /**
     * @param  array  $items  [{type, product_id|ring_id+stone_id, qty, size}]
     * @return array raw quote (minor units) — see present() for the API shape
     */
    public function quote(array $items, ?string $couponCode = null, ?string $shippingCode = null, ?User $user = null, ?string $currency = null): array
    {
        $currency ??= $this->currency->current();
        $products = Product::with(['images', 'category'])
            ->whereIn('id', collect($items)->where('type', 'product')->pluck('product_id')->filter()->unique())
            ->get()->keyBy('id');
        $combos = $this->loadCombos($items);

        $qtyByProduct = [];
        $lines = [];
        foreach (array_values($items) as $index => $item) {
            $lines[] = ($item['type'] ?? null) === 'custom_ring'
                ? $this->customRingLine($index, $item, $combos, $currency, $user)
                : $this->productLine($index, $item, $products, $qtyByProduct, $currency, $user);
        }

        $valid = collect($lines)->where('available', true);
        $subtotal = (int) $valid->sum('line_total');
        $subtotalEur = (int) $valid->sum(fn ($l) => $l['unit_price_eur'] * $l['qty']);

        // Business accounts already get their tier prices; coupons are for retail customers only.
        [$coupon, $couponError] = $user?->isBusiness() && $couponCode
            ? [null, 'Coupons are not available for business accounts.']
            : $this->coupons->check($couponCode, $subtotalEur, $user);

        $methods = ShippingMethod::where('is_active', true)->orderBy('sort_order')->get();
        $selected = $shippingCode ? $methods->firstWhere('code', $shippingCode) : null;
        $totals = $this->pricing->totals($subtotal, $coupon, $selected ?? $methods->first(), $currency);
        $taxable = $totals['taxable'];

        return [
            'currency' => $currency,
            'exchange_rate' => $this->currency->rate($currency),
            'lines' => $lines,
            'valid' => count($lines) > 0 && $valid->count() === count($lines),
            'coupon' => $couponCode ? [
                'code' => strtoupper(trim($couponCode)),
                'valid' => (bool) $coupon,
                'message' => $couponError ?? ($coupon ? ($coupon->label ?: 'Coupon applied.') : null),
                'model' => $coupon,
            ] : null,
            'shipping_options' => $methods->map(fn (ShippingMethod $m) => [
                'model' => $m,
                'cost' => $this->pricing->shippingCost($m, $taxable, $currency),
            ])->all(),
            'shipping_method' => $selected ?? $methods->first(),
            'shipping_error' => $shippingCode && ! $selected ? 'This shipping method is not available.' : null,
            'free_shipping_threshold' => $this->pricing->freeShippingThreshold($currency),
            'totals' => $totals,
            'subtotal_eur' => $subtotalEur,
            'gold_rate' => $this->gold->current(),
        ];
    }

    private function loadCombos(array $items): Collection
    {
        $pairs = collect($items)->where('type', 'custom_ring');
        if ($pairs->isEmpty()) {
            return collect();
        }

        return ConfigRingStone::with(['ring', 'stone'])
            ->whereIn('ring_id', $pairs->pluck('ring_id')->filter())
            ->whereIn('stone_id', $pairs->pluck('stone_id')->filter())
            ->get()->keyBy(fn ($c) => $c->ring_id.':'.$c->stone_id);
    }

    private function productLine(int $index, array $item, Collection $products, array &$qtyByProduct, string $currency, ?User $user): array
    {
        $qty = max(1, (int) ($item['qty'] ?? 1));
        $size = isset($item['size']) && $item['size'] !== '' ? (string) $item['size'] : null;
        $product = $products->get($item['product_id'] ?? 0);
        $line = ['index' => $index, 'type' => 'product', 'product_id' => $item['product_id'] ?? null, 'qty' => $qty, 'size' => $size];

        if (! $product) {
            return $line + ['available' => false, 'errors' => ['not_found'], 'name' => null, 'unit_price' => 0, 'line_total' => 0, 'unit_price_eur' => 0];
        }

        $errors = [];
        if (! $product->isPurchasable()) {
            $errors[] = 'inactive';
        }
        if ($product->has_sizes) {
            if ($size === null || ! in_array($size, array_map('strval', $product->sizes ?? []), true)) {
                $errors[] = 'invalid_size';
            }
        } else {
            $size = null;
        }
        $qtyByProduct[$product->id] = ($qtyByProduct[$product->id] ?? 0) + $qty;
        if ($product->track_stock && $qtyByProduct[$product->id] > $product->stock_qty) {
            $errors[] = 'out_of_stock';
        }

        $percent = $this->b2b->productPercent($user, $product);
        $unitEur = $this->b2b->apply($product->price, $percent);
        $unit = $this->pricing->productUnitPrice($unitEur, $currency);

        return array_merge($line, [
            'size' => $size,
            'product' => $product,
            'name' => $product->name,
            'subtitle' => $product->subtitle,
            'image' => $product->main_image,
            'unit_price' => $unit,
            'line_total' => $unit * $qty,
            'unit_price_eur' => $unitEur,
            'retail_unit_price' => $user?->isBusiness() ? $this->pricing->productUnitPrice($product->price, $currency) : null,
            'b2b_percent' => $user?->isBusiness() ? $percent : null,
            'compare_at_price' => $product->compare_at_price ? $this->pricing->productUnitPrice($product->compare_at_price, $currency) : null,
            'in_stock' => $product->in_stock,
            'available' => empty($errors),
            'errors' => $errors,
            'snapshot' => array_filter([
                'sku' => $product->sku,
                'slug' => $product->slug,
                'legacy_id' => $product->legacy_id,
                'metal' => $product->metal,
                'stone' => $product->stone,
                'compare_at_price' => $product->compare_at_price,
                'retail_unit_price_eur' => $user?->isBusiness() ? $product->price : null,
                'b2b_percent' => $user?->isBusiness() ? $percent : null,
            ], fn ($v) => $v !== null),
        ]);
    }

    private function customRingLine(int $index, array $item, Collection $combos, string $currency, ?User $user): array
    {
        $qty = max(1, (int) ($item['qty'] ?? 1));
        $size = isset($item['size']) ? (string) $item['size'] : null;
        $combo = $combos->get(($item['ring_id'] ?? 0).':'.($item['stone_id'] ?? 0));
        $line = ['index' => $index, 'type' => 'custom_ring', 'ring_id' => $item['ring_id'] ?? null, 'stone_id' => $item['stone_id'] ?? null, 'qty' => $qty, 'size' => $size];

        if (! $combo || ! $combo->ring || ! $combo->stone) {
            return $line + ['available' => false, 'errors' => ['combo_unavailable'], 'name' => null, 'unit_price' => 0, 'line_total' => 0, 'unit_price_eur' => 0];
        }

        $ring = $combo->ring;
        $stone = $combo->stone;
        $errors = [];
        if (! $combo->isAvailable()) {
            $errors[] = 'combo_unavailable';
        }
        if ($size === null || ! in_array($size, array_map('strval', $ring->sizes ?? []), true)) {
            $errors[] = 'invalid_size';
        }

        $price = $this->pricing->configuratorPrice($ring, $stone, $currency);
        $eur = $price['eur'];
        $gold = $this->gold->current();
        // Business accounts: tier % of the Design Your Ring row, on the ring total.
        $percent = $this->b2b->ringPercent($user);
        $unit = $this->b2b->apply($price['total'], $percent);

        return array_merge($line, [
            'ring' => $ring,
            'stone' => $stone,
            'name' => $ring->name.' with '.$stone->name,
            'subtitle' => $ring->karat.'K '.($ring->metal_color ? ucfirst($ring->metal_color).' ' : '').'Gold · '.$ring->setting,
            'image' => $combo->imageOrRing(),
            'unit_price' => $unit,
            'line_total' => $unit * $qty,
            'unit_price_eur' => $this->b2b->apply($eur['total'], $percent),
            'retail_unit_price' => $user?->isBusiness() ? $price['total'] : null,
            'b2b_percent' => $user?->isBusiness() ? $percent : null,
            'breakdown' => $price,
            'available' => empty($errors),
            'errors' => $errors,
            'snapshot' => [
                'ring_name' => $ring->name,
                'setting' => $ring->setting,
                'karat' => $ring->karat,
                'metal_color' => $ring->metal_color,
                'gold_weight_g' => (float) $ring->gold_weight_g,
                'gold_rate_per_oz_eur' => $eur['gold_rate_per_oz'],
                'gold_rate_source' => $gold['source'],
                'gold_value_eur' => $eur['gold_value'],
                'craft_fee_eur' => $eur['craft_fee'],
                'stone_name' => $stone->name,
                'stone_price_eur' => $eur['stone_price'],
                'ring_charge_eur' => $eur['ring_charge'],
                'delivery_text' => $ring->delivery_text,
            ] + ($user?->isBusiness() ? ['retail_unit_price_eur' => $eur['total'], 'b2b_percent' => $percent] : []),
        ]);
    }

    /** API shape: every amount as {amount, currency, formatted}. */
    public function present(array $q): array
    {
        $c = $q['currency'];
        $m = fn (?int $v) => $this->currency->money($v, $c);

        return [
            'currency' => $c,
            'valid' => $q['valid'],
            'lines' => array_map(fn ($l) => array_filter([
                'index' => $l['index'],
                'type' => $l['type'],
                'product_id' => $l['product_id'] ?? null,
                'product_slug' => isset($l['product']) ? $l['product']->slug : null,
                'legacy_id' => isset($l['product']) ? $l['product']->legacy_id : null,
                'ring_id' => $l['ring_id'] ?? null,
                'stone_id' => $l['stone_id'] ?? null,
                'name' => $l['name'],
                'subtitle' => $l['subtitle'] ?? null,
                'image' => Media::url($l['image'] ?? null),
                'size' => $l['size'],
                'qty' => $l['qty'],
                'unit_price' => $m($l['unit_price']),
                'retail_unit_price' => isset($l['retail_unit_price']) ? $m($l['retail_unit_price']) : null,
                'b2b_percent' => $l['b2b_percent'] ?? null,
                'compare_at_price' => isset($l['compare_at_price']) ? $m($l['compare_at_price']) : null,
                'line_total' => $m($l['line_total']),
                'breakdown' => isset($l['breakdown']) ? [
                    'gold_value' => $m($l['breakdown']['gold_value']),
                    'craft_fee' => $m($l['breakdown']['craft_fee']),
                    'ring_charge' => $m($l['breakdown']['ring_charge']),
                    'stone_price' => $m($l['breakdown']['stone_price']),
                    'karat' => $l['breakdown']['eur']['karat'],
                    'gold_weight_g' => $l['breakdown']['eur']['gold_weight_g'],
                    'delivery_text' => $l['snapshot']['delivery_text'],
                ] : null,
                'available' => $l['available'],
                'errors' => $l['errors'],
            ], fn ($v) => $v !== null), $q['lines']),
            'coupon' => $q['coupon'] ? [
                'code' => $q['coupon']['code'],
                'valid' => $q['coupon']['valid'],
                'message' => $q['coupon']['message'],
                'type' => $q['coupon']['model']?->type,
                'percent' => $q['coupon']['model']?->type === 'percent' ? $q['coupon']['model']->value : null,
                'discount' => $m($q['totals']['discount']),
            ] : null,
            'shipping_options' => array_map(fn ($o) => [
                'code' => $o['model']->code,
                'name' => $o['model']->name,
                'delivery_time' => $o['model']->delivery_time,
                'price' => $m($o['cost']),
                'is_free' => $o['cost'] === 0,
                'free_over_threshold' => $o['model']->free_over_threshold,
                'selected' => $q['shipping_method'] && $o['model']->is($q['shipping_method']),
            ], $q['shipping_options']),
            'shipping_error' => $q['shipping_error'],
            'free_shipping_threshold' => $m($q['free_shipping_threshold']),
            'amount_to_free_shipping' => $m(max(0, $q['free_shipping_threshold'] - $q['totals']['taxable'])),
            'totals' => [
                'subtotal' => $m($q['totals']['subtotal']),
                'discount' => $m($q['totals']['discount']),
                'shipping' => $m($q['totals']['shipping']),
                'tax_rate' => $q['totals']['tax_rate'],
                'tax' => $m($q['totals']['tax']),
                'total' => $m($q['totals']['total']),
            ],
            'gold_rate' => $this->presentGold($q['gold_rate'], $c),
        ];
    }

    public function presentGold(array $gold, ?string $currency = null): array
    {
        return [
            'per_oz' => $this->currency->moneyFromEur($gold['per_oz'], $currency),
            'per_oz_eur' => $this->currency->money($gold['per_oz'], 'EUR'),
            'source' => $gold['source'],
            'updated_at' => $gold['updated_at']?->toIso8601String(),
        ];
    }
}
