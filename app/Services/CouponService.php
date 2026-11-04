<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\Order;
use App\Models\User;

class CouponService
{
    /**
     * Validates a code for a cart. Returns [coupon|null, error message|null].
     *
     * @param  int  $subtotalEur  cart subtotal in EUR minor units (min_subtotal is EUR)
     */
    public function check(?string $code, int $subtotalEur, ?User $user = null): array
    {
        $code = strtoupper(trim((string) $code));
        if ($code === '') {
            return [null, null];
        }

        $coupon = Coupon::where('code', $code)->first();
        if (! $coupon || ! $coupon->is_active) {
            return [null, 'This coupon code is not valid.'];
        }
        if ($coupon->starts_at && $coupon->starts_at->isFuture()) {
            return [null, 'This coupon is not active yet.'];
        }
        if ($coupon->expires_at && $coupon->expires_at->isPast()) {
            return [null, 'This coupon has expired.'];
        }
        if ($coupon->usage_limit !== null && $coupon->used_count >= $coupon->usage_limit) {
            return [null, 'This coupon has reached its usage limit.'];
        }
        if ($coupon->min_subtotal && $subtotalEur < $coupon->min_subtotal) {
            $min = app(CurrencyService::class)->moneyFromEur($coupon->min_subtotal);

            return [null, "This coupon needs a minimum order of {$min['formatted']}."];
        }
        if ($user && $coupon->per_user_limit !== null && $this->usesByUser($coupon, $user) >= $coupon->per_user_limit) {
            return [null, 'You have already used this coupon.'];
        }

        return [$coupon, null];
    }

    public function usesByUser(Coupon $coupon, User $user): int
    {
        return Order::where('user_id', $user->id)->where('coupon_code', $coupon->code)
            ->whereIn('status', ['paid', 'partially_refunded', 'refunded'])->count();
    }

    public function snapshot(Coupon $coupon): array
    {
        return $coupon->only(['id', 'code', 'label', 'type', 'value', 'min_subtotal']);
    }
}
