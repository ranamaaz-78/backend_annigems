<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Live gold and silver spot prices for the storefront feed.
 *
 * DISPLAY ONLY: product prices keep using GoldRateService (the source chosen in admin).
 * The provider quotes USD per troy ounce; values are cached, and the last good
 * reading is served (flagged `stale`) while the provider is failing.
 */
class MetalRatesService
{
    private const METALS = ['XAU' => 'Gold', 'XAG' => 'Silver'];

    /** Purities shown per gram: label => fraction of fine metal. */
    private const PURITIES = [
        'XAU' => ['24K' => 1.0, '22K' => 22 / 24, '18K' => 18 / 24],
        'XAG' => ['999' => 1.0, '925' => 0.925],
    ];

    private const CACHE_KEY = 'metal-rates';

    private const REFRESH_SECONDS = 60;

    public function __construct(private CurrencyService $currency) {}

    public function feed(): ?array
    {
        $state = $this->state();
        if (! $state) {
            return null;
        }

        $usdPerEur = $this->currency->rate('USD');
        $money = fn (float $usd) => $this->currency->moneyFromEur((int) round($usd / $usdPerEur * 100));

        $metals = [];
        foreach (self::METALS as $symbol => $name) {
            $usd = $state['prices'][$symbol];
            $open = $state['open'][$symbol];
            $metals[] = [
                'symbol' => $symbol,
                'name' => $name,
                'per_oz' => $money($usd),
                'per_gram' => collect(self::PURITIES[$symbol])->map(fn ($purity, $label) => [
                    'purity' => (string) $label,
                    'price' => $money($usd * $purity / PricingService::GRAMS_PER_TROY_OZ),
                ])->values()->all(),
                // Movement since the first reading of the day (UTC) seen by this server.
                'change_percent' => $open > 0 ? round(($usd - $open) / $open * 100, 2) : 0.0,
            ];
        }

        return [
            'metals' => $metals,
            'updated_at' => $state['fetched_at'],
            'stale' => now()->diffInMinutes($state['fetched_at'], true) >= 10,
        ];
    }

    private function state(): ?array
    {
        $state = Cache::get(self::CACHE_KEY);

        // At most one provider call per interval, whether it succeeds or not.
        if (Cache::add(self::CACHE_KEY.':attempt', true, self::REFRESH_SECONDS)) {
            try {
                $prices = [];
                foreach (array_keys(self::METALS) as $symbol) {
                    $price = Http::timeout(6)->acceptJson()
                        ->withOptions(['verify' => config('services.metals.ca_bundle') ?: true])
                        ->get(rtrim(config('services.metals.url'), '/').'/'.$symbol)
                        ->throw()->json('price');
                    if (! is_numeric($price) || $price <= 0) {
                        throw new \UnexpectedValueException("No price for {$symbol}.");
                    }
                    $prices[$symbol] = (float) $price;
                }
                $today = now('UTC')->toDateString();
                $state = [
                    'prices' => $prices,
                    'open' => ($state['day'] ?? null) === $today ? $state['open'] : $prices,
                    'day' => $today,
                    'fetched_at' => now()->toIso8601String(),
                ];
                Cache::forever(self::CACHE_KEY, $state);
            } catch (Throwable $e) {
                Log::warning('Metal rates fetch failed: '.$e->getMessage());
            }
        }

        return $state;
    }
}
