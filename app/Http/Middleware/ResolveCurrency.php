<?php

namespace App\Http\Middleware;

use App\Services\CurrencyService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Reads X-Currency (default EUR; unknown/disabled falls back to EUR). */
class ResolveCurrency
{
    public function __construct(private CurrencyService $currencies) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->currencies->setRequestCurrency($request->header('X-Currency'));

        return $next($request);
    }
}
