<?php

namespace App\Services;

class CurrencyService
{
    private string $requestCurrency = 'EUR';

    public function setRequestCurrency(?string $code): void
    {
        $this->requestCurrency = 'EUR';
    }

    public function current(): string
    {
        return $this->requestCurrency;
    }
}
