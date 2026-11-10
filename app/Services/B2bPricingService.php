<?php

namespace App\Services;

use App\Models\B2bTierDiscount;
use App\Models\Product;
use App\Models\User;

/**
 * B2B (business account) prices: the tier of the business gives a discount % per category,
 * plus one row (category_id null) for Design Your Ring custom rings. Retail customers get 0%.
 *
 *   b2b_price = round(retail × (100 − percent) / 100)    (EUR minor units, before currency conversion)
 *
 * Registered as a singleton; tier rows are cached for the current request only.
 */
class B2bPricingService
{
    /** @var array<int, array<string, float>> tier id => [category id | 'ring' => percent] */
    private array $tiers = [];

    /** @var array<int, int|null> user id => tier id */
    private array $userTiers = [];

    private ?int $requestId = null;

    private function fresh(): void
    {
        $id = spl_object_id(request());
        if ($this->requestId !== $id) {
            $this->requestId = $id;
            $this->tiers = [];
            $this->userTiers = [];
        }
    }

    /** Business user of the current API request (Bearer token), if any. Works on public routes too. */
    public function currentBusiness(): ?User
    {
        $user = request()->user('sanctum');

        return $user instanceof User && $user->isBusiness() && $user->is_active ? $user : null;
    }

    public function tierId(?User $user): ?int
    {
        if (! $user || ! $user->isBusiness()) {
            return null;
        }
        $this->fresh();
        if (! array_key_exists($user->id, $this->userTiers)) {
            $this->userTiers[$user->id] = $user->businessProfile?->tier_id;
        }

        return $this->userTiers[$user->id];
    }

    public function productPercent(?User $user, Product $product): float
    {
        return $this->percent($user, (string) $product->category_id);
    }

    public function ringPercent(?User $user): float
    {
        return $this->percent($user, 'ring');
    }

    public function apply(int $amount, float $percent): int
    {
        return $percent > 0 ? (int) round($amount * (100 - $percent) / 100) : $amount;
    }

    /** All discounts of a tier: [category id | 'ring' => percent]. */
    public function tierPercents(int $tierId): array
    {
        $this->fresh();

        return $this->tiers[$tierId] ??= B2bTierDiscount::where('tier_id', $tierId)->get()
            ->mapWithKeys(fn ($d) => [$d->category_id === null ? 'ring' : (string) $d->category_id => (float) $d->percent])
            ->all();
    }

    private function percent(?User $user, string $key): float
    {
        $tier = $this->tierId($user);

        return $tier ? min(100, max(0, $this->tierPercents($tier)[$key] ?? 0)) : 0.0;
    }
}
