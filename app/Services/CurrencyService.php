<?php

namespace App\Services;

use App\Models\Currency;
use App\Models\ExchangeRate;
use App\Models\Setting;
use App\Services\Rates\ExchangeRateProvider;
use App\Services\Rates\RateProviderException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use NumberFormatter;

/**
 * Currencies and EUR → currency conversion.
 *
 * Rule (same as gold): whichever fx.source is selected in admin is used; no
 * automatic switching. With `api`, the last good API rates are kept when the
 * provider fails. Choosing `api` requires a successful fetch first.
 */
class CurrencyService
{
    public const BASE = 'EUR';

    private string $requestCurrency = self::BASE;

    private ?string $requested = null;

    private ?Collection $currencies = null;

    private array $rateMemo = [];

    public function __construct(private ExchangeRateProvider $provider) {}

    // ---- request currency -------------------------------------------------

    /** X-Currency header; unknown or disabled currencies fall back to EUR. */
    public function setRequestCurrency(?string $code): void
    {
        $this->requested = $code ? strtoupper(trim($code)) : null;
        $this->requestCurrency = $this->requested && $this->isActive($this->requested) ? $this->requested : self::BASE;
    }

    public function current(): string
    {
        return $this->requestCurrency;
    }

    public function requested(): ?string
    {
        return $this->requested;
    }

    // ---- currencies --------------------------------------------------------

    public function all(): Collection
    {
        return $this->currencies ??= Currency::orderBy('sort_order')->get()->keyBy('code');
    }

    public function active(): Collection
    {
        return $this->all()->filter(fn (Currency $c) => $c->is_active || $c->is_base);
    }

    public function isActive(string $code): bool
    {
        $c = $this->all()->get(strtoupper($code));

        return (bool) ($c && ($c->is_active || $c->is_base));
    }

    public function source(): string
    {
        return Setting::get('fx.source', 'manual') === 'api' ? 'api' : 'manual';
    }

    /** 1 EUR = rate × currency, from the selected source. */
    public function rate(?string $code = null): float
    {
        $code = strtoupper($code ?? $this->requestCurrency);
        if ($code === self::BASE) {
            return 1.0;
        }

        return $this->rateMemo[$code] ??= (float) ($this->latestRate($code, $this->source())?->rate
            ?? throw new \RuntimeException("No {$this->source()} exchange rate for {$code}."));
    }

    public function latestRate(string $code, string $source): ?ExchangeRate
    {
        return ExchangeRate::where('currency_code', $code)->where('source', $source)
            ->orderByDesc('fetched_at')->orderByDesc('id')->first();
    }

    /** Converts an EUR minor amount: display_minor = round(eur_minor × rate). */
    public function convert(int $eurMinor, ?string $code = null): int
    {
        $code = $code ?? $this->requestCurrency;

        return $code === self::BASE ? $eurMinor : (int) round($eurMinor * $this->rate($code));
    }

    /** Converts a currency minor amount back to EUR minor (for filters and reporting). */
    public function toEur(int $minor, ?string $code = null, ?float $rate = null): int
    {
        $rate = $rate ?? $this->rate($code);

        return (int) round($minor / $rate);
    }

    /** The one money shape: {amount, currency, formatted}. */
    public function money(?int $minor, ?string $code = null): ?array
    {
        if ($minor === null) {
            return null;
        }
        $code = strtoupper($code ?? $this->requestCurrency);

        return ['amount' => $minor, 'currency' => $code, 'formatted' => $this->format($minor, $code)];
    }

    /** EUR minor → money in the request (or given) currency. */
    public function moneyFromEur(?int $eurMinor, ?string $code = null): ?array
    {
        return $eurMinor === null ? null : $this->money($this->convert($eurMinor, $code), $code ?? $this->requestCurrency);
    }

    public function format(int $minor, string $code): string
    {
        $decimals = $this->all()->get($code)?->decimals ?? 2;
        $fmt = new NumberFormatter('en', NumberFormatter::CURRENCY);
        $fmt->setAttribute(NumberFormatter::FRACTION_DIGITS, $decimals);
        $symbol = $this->all()->get($code)?->symbol;
        if ($symbol) {
            $fmt->setSymbol(NumberFormatter::CURRENCY_SYMBOL, $code === 'AED' ? 'AED ' : $symbol);
        }

        return $fmt->formatCurrency($minor / (10 ** $decimals), $code);
    }

    /** Active currencies with the rate in use (for bootstrap and admin). */
    public function summary(): array
    {
        return $this->active()->values()->map(fn (Currency $c) => [
            'code' => $c->code,
            'symbol' => $c->symbol,
            'name' => $c->name,
            'decimals' => $c->decimals,
            'is_base' => $c->is_base,
            'rate' => $c->is_base ? 1.0 : $this->safeRate($c->code),
        ])->all();
    }

    private function safeRate(string $code): ?float
    {
        try {
            return $this->rate($code);
        } catch (\RuntimeException) {
            return null;
        }
    }

    // ---- API fetch + source switching --------------------------------------

    /**
     * Fetches API rates for every non-base currency. On failure, the last
     * good API rates stay in place and the error is recorded.
     *
     * @return array{ok: bool, error?: string, rates?: array}
     */
    public function fetchFromApi(): array
    {
        $codes = $this->all()->reject(fn (Currency $c) => $c->is_base)->keys()->all();
        try {
            $rates = $this->provider->fetch($codes);
        } catch (RateProviderException $e) {
            Log::warning('FX fetch failed: '.$e->getMessage());
            Setting::put('fx.last_error', ['message' => $e->getMessage(), 'at' => now()->toIso8601String()]);

            return ['ok' => false, 'error' => $e->getMessage()];
        }

        $now = now();
        foreach ($rates as $code => $rate) {
            ExchangeRate::create(['currency_code' => $code, 'rate' => $rate, 'source' => 'api', 'fetched_at' => $now]);
        }
        Setting::put('fx.last_api_success_at', $now->toIso8601String());
        Setting::put('fx.last_error', null);
        $this->rateMemo = [];

        return ['ok' => true, 'rates' => $rates];
    }

    public function hasApiRates(): bool
    {
        $codes = $this->all()->reject(fn (Currency $c) => $c->is_base)->keys();

        return $codes->every(fn ($code) => ExchangeRate::where('currency_code', $code)->where('source', 'api')->exists());
    }

    public function setSource(string $source): void
    {
        if ($source === 'api' && ! $this->hasApiRates()) {
            throw ValidationException::withMessages(['source' => 'Run "Test & fetch now" successfully before switching to API rates.']);
        }
        Setting::put('fx.source', $source);
        $this->rateMemo = [];
    }

    public function setManualRate(string $code, float $rate): void
    {
        ExchangeRate::create(['currency_code' => strtoupper($code), 'rate' => $rate, 'source' => 'manual', 'fetched_at' => now()]);
        $this->rateMemo = [];
    }

    public function status(): array
    {
        $lastApi = Setting::get('fx.last_api_success_at');

        return [
            'source' => $this->source(),
            'fetch_interval_minutes' => (int) Setting::get('fx.fetch_interval_minutes', 720),
            'last_api_success_at' => $lastApi,
            'last_error' => Setting::get('fx.last_error'),
            'has_api_rates' => $this->hasApiRates(),
            'stale' => $this->source() === 'api' && $lastApi
                && now()->diffInMinutes($lastApi, true) > 2 * (int) Setting::get('fx.fetch_interval_minutes', 720),
        ];
    }

    public function resetMemo(): void
    {
        $this->currencies = null;
        $this->rateMemo = [];
    }
}
