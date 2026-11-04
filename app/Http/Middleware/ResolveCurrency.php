<?php

namespace App\Http\Middleware;

use App\Services\CurrencyService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Reads X-Currency (default EUR; unknown/disabled falls back to EUR) and adds
 * meta.currency to every JSON response so clients know which one was used.
 */
class ResolveCurrency
{
    public function __construct(private CurrencyService $currencies) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->currencies->resetMemo();
        $this->currencies->setRequestCurrency($request->header('X-Currency'));
        $response = $next($request);

        if ($response instanceof JsonResponse && $response->isSuccessful()) {
            $data = $response->getData(true);
            if (is_array($data) && array_key_exists('data', $data)) {
                $data['meta'] = array_merge($data['meta'] ?? [], ['currency' => $this->currencies->current()]);
                $response->setData($data);
            }
        }

        return $response;
    }
}
