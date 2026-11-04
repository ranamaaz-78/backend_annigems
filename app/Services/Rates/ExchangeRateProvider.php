<?php

namespace App\Services\Rates;

interface ExchangeRateProvider
{
    public function name(): string;

    /**
     * Rates against EUR: [code => rate] where 1 EUR = rate × currency.
     *
     * @param  string[]  $codes
     * @return array<string, float>
     *
     * @throws RateProviderException
     */
    public function fetch(array $codes): array;
}
