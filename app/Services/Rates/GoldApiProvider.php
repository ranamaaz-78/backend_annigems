<?php

namespace App\Services\Rates;

use Illuminate\Support\Facades\Http;
use Throwable;

/** GoldAPI.io: GET https://www.goldapi.io/api/XAU/EUR (header x-access-token). */
class GoldApiProvider implements GoldRateProvider
{
    public function name(): string
    {
        return 'goldapi';
    }

    public function fetch(): array
    {
        $key = config('services.goldapi.key');
        if (! $key) {
            throw new RateProviderException('GOLD_API_KEY is not configured.');
        }

        try {
            $res = Http::timeout(15)
                ->withHeaders(['x-access-token' => $key, 'Accept' => 'application/json'])
                ->get(config('services.goldapi.url'));
        } catch (Throwable $e) {
            throw new RateProviderException('GoldAPI request failed: '.$e->getMessage(), previous: $e);
        }

        if (! $res->successful()) {
            throw new RateProviderException('GoldAPI responded with HTTP '.$res->status().': '.mb_substr($res->body(), 0, 200));
        }
        $price = $res->json('price');
        if (! is_numeric($price) || $price <= 0 || strtoupper((string) $res->json('currency', 'EUR')) !== 'EUR') {
            throw new RateProviderException('GoldAPI returned an unexpected payload.');
        }

        return ['rate_per_oz' => (int) round($price * 100), 'raw' => $res->json()];
    }
}
