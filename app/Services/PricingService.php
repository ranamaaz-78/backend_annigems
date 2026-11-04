<?php

namespace App\Services;

use App\Models\ConfigRing;
use App\Models\ConfigStone;
use App\Models\Coupon;
use App\Models\Setting;
use App\Models\ShippingMethod;

/**
 * Single source of every price the store shows or charges.
 * All admin prices are EUR minor units; conversion happens per unit price first.
 */
class PricingService
{
    public const GRAMS_PER_TROY_OZ = 31.1034768;

    public function __construct(private GoldRateService $gold, private CurrencyService $currency) {}

    /**
     * Configurator price in EUR (minor units).
     *
     *   purity        = karat / 24
     *   gold_per_gram = gold_rate_per_oz_eur / 31.1034768
     *   gold_value    = gold_weight_g × purity × gold_per_gram   (rounded to cents)
     *   ring_charge   = gold_value + craft_fee
     *   total         = ring_charge + stone.price
     *
     * Ring size never changes the price.
     */
    public function configuratorPriceEur(ConfigRing $ring, ?ConfigStone $stone = null, ?int $ratePerOz = null): array
    {
        $ratePerOz ??= $this->gold->perOz();
        $purity = $ring->karat / 24;
        $goldPerGram = $ratePerOz / self::GRAMS_PER_TROY_OZ;
        $goldValue = (int) round((float) $ring->gold_weight_g * $purity * $goldPerGram);
        $ringCharge = $goldValue + $ring->craft_fee;
        $stonePrice = $stone?->price ?? 0;

        return [
            'karat' => $ring->karat,
            'purity' => round($purity, 4),
            'gold_weight_g' => (float) $ring->gold_weight_g,
            'gold_rate_per_oz' => $ratePerOz,
            'gold_value' => $goldValue,
            'craft_fee' => $ring->craft_fee,
            'ring_charge' => $ringCharge,
            'stone_price' => $stonePrice,
            'total' => $ringCharge + $stonePrice,
        ];
    }

    /**
     * Configurator price converted to a currency. Each component is converted
     * first and the totals are summed in the target currency so they add up.
     */
    public function configuratorPrice(ConfigRing $ring, ?ConfigStone $stone = null, ?string $currency = null): array
    {
        $currency ??= $this->currency->current();
        $eur = $this->configuratorPriceEur($ring, $stone);
        $gold = $this->currency->convert($eur['gold_value'], $currency);
        $craft = $this->currency->convert($eur['craft_fee'], $currency);
        $stonePrice = $this->currency->convert($eur['stone_price'], $currency);

        return [
            'eur' => $eur,
            'currency' => $currency,
            'gold_value' => $gold,
            'craft_fee' => $craft,
            'ring_charge' => $gold + $craft,
            'stone_price' => $stonePrice,
            'total' => $gold + $craft + $stonePrice,
        ];
    }

    /** Unit price of a catalog product in the currency. */
    public function productUnitPrice(int $priceEur, ?string $currency = null): int
    {
        return $this->currency->convert($priceEur, $currency);
    }

    /**
     * Cart totals in the target currency (same formula as the storefront):
     *
     *   subtotal = Σ line totals
     *   discount = coupon on subtotal (percent rounded, or fixed, ≤ subtotal)
     *   taxable  = subtotal − discount
     *   shipping = method price, or 0 if free_over_threshold and taxable ≥ threshold
     *   tax      = round(taxable × tax.rate)
     *   total    = taxable + shipping + tax
     */
    public function totals(int $subtotal, ?Coupon $coupon, ?ShippingMethod $method, ?string $currency = null): array
    {
        $currency ??= $this->currency->current();
        $discount = $this->discount($subtotal, $coupon, $currency);
        $taxable = $subtotal - $discount;
        $shipping = $method ? $this->shippingCost($method, $taxable, $currency) : 0;
        $taxRate = (float) Setting::get('tax.rate', 0);
        $tax = (int) round($taxable * $taxRate);

        return [
            'currency' => $currency,
            'subtotal' => $subtotal,
            'discount' => $discount,
            'taxable' => $taxable,
            'shipping' => $shipping,
            'tax_rate' => $taxRate,
            'tax' => $tax,
            'total' => $taxable + $shipping + $tax,
        ];
    }

    public function discount(int $subtotal, ?Coupon $coupon, ?string $currency = null): int
    {
        if (! $coupon || $subtotal <= 0) {
            return 0;
        }
        $amount = $coupon->type === 'percent'
            ? (int) round($subtotal * $coupon->value / 100)
            : $this->currency->convert($coupon->value, $currency);

        return min($amount, $subtotal);
    }

    public function freeShippingThreshold(?string $currency = null): int
    {
        return $this->currency->convert((int) Setting::get('shipping.free_threshold', 0), $currency);
    }

    public function shippingCost(ShippingMethod $method, int $taxable, ?string $currency = null): int
    {
        if ($method->free_over_threshold && $taxable >= $this->freeShippingThreshold($currency)) {
            return 0;
        }

        return $this->currency->convert($method->price, $currency);
    }
}
