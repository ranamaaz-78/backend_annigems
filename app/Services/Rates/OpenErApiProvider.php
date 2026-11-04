<?php

namespace App\Services\Rates;

use Illuminate\Support\Facades\Http;
use Throwable;

/** open.er-api.com (free, no key): GET /v6/latest/EUR */
class OpenErApiProvider implements ExchangeRateProvider
{
    public function name(): string
    {
        return 'open.er-api';
    }

    public function fetch(array $codes): array
    {
        try {
            $res = Http::timeout(15)->acceptJson()->get(config('services.fx.url'));
        } catch (Throwable $e) {
            throw new RateProviderException('Exchange-rate request failed: '.$e->getMessage(), previous: $e);
        }
        if (! $res->successful() || $res->json('result') !== 'success') {
            throw new RateProviderException('Exchange-rate API error (HTTP '.$res->status().').');
        }
        $rates = $res->json('rates', []);
        $out = [];
        foreach ($codes as $code) {
            if (! isset($rates[$code]) || ! is_numeric($rates[$code]) || $rates[$code] <= 0) {
                throw new RateProviderException("Exchange-rate API has no rate for {$code}.");
            }
            $out[$code] = (float) $rates[$code];
        }

        return $out;
    }
}
