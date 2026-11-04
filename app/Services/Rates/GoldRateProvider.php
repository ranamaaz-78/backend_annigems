<?php

namespace App\Services\Rates;

interface GoldRateProvider
{
    /** Unique provider key (stored on gold_rates.provider). */
    public function name(): string;

    /**
     * Current price of one troy ounce of gold in EUR.
     *
     * @return array{rate_per_oz: int, raw: array} rate in EUR minor units
     *
     * @throws RateProviderException
     */
    public function fetch(): array;
}
