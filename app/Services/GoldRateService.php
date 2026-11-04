<?php

namespace App\Services;

use App\Mail\GoldRateApiFailing;
use App\Models\GoldRate;
use App\Models\Setting;
use App\Services\Rates\GoldRateProvider;
use App\Services\Rates\RateProviderException;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * Gold rate (EUR per troy ounce, minor units).
 *
 * - The source selected in admin (`gold.source` = api | manual) is the one used.
 *   There is NO automatic switching between api and manual.
 * - With `api`, a failing provider never breaks the store: the last good API
 *   rate is used, the error is logged and the admin sees a warning.
 * - Switching to `api` requires a successful "Test & fetch now" first.
 */
class GoldRateService
{
    public const FAILURE_ALERT_THRESHOLD = 3;

    private ?array $memo = null;

    public function __construct(private GoldRateProvider $provider) {}

    public function source(): string
    {
        return Setting::get('gold.source', 'manual') === 'api' ? 'api' : 'manual';
    }

    public function lastGoodApiRate(): ?GoldRate
    {
        return GoldRate::where('source', 'api')->orderByDesc('fetched_at')->orderByDesc('id')->first();
    }

    /** @return array{per_oz: int, source: string, updated_at: ?CarbonInterface, provider: ?string} */
    public function current(): array
    {
        if ($this->memo) {
            return $this->memo;
        }

        if ($this->source() === 'api') {
            $row = $this->lastGoodApiRate();
            if ($row) {
                return $this->memo = ['per_oz' => $row->rate_per_oz, 'source' => 'api', 'updated_at' => $row->fetched_at, 'provider' => $row->provider];
            }
            // Cannot normally happen (switching to api requires a good fetch).
            Log::error('Gold source is api but no API rate exists; using manual rate.');
        }

        $manual = GoldRate::where('source', 'manual')->orderByDesc('fetched_at')->orderByDesc('id')->first();

        return $this->memo = [
            'per_oz' => (int) Setting::get('gold.manual_rate_per_oz', $manual?->rate_per_oz ?? 0),
            'source' => 'manual',
            'updated_at' => $manual?->fetched_at,
            'provider' => null,
        ];
    }

    public function perOz(): int
    {
        return $this->current()['per_oz'];
    }

    /**
     * Fetch from the provider and store it as the new last good API rate.
     *
     * @return array{ok: bool, rate?: GoldRate, error?: string}
     */
    public function fetchFromApi(): array
    {
        try {
            $result = $this->provider->fetch();
        } catch (RateProviderException $e) {
            return $this->recordFailure($e->getMessage());
        }

        $row = GoldRate::create([
            'source' => 'api',
            'rate_per_oz' => $result['rate_per_oz'],
            'fetched_at' => now(),
            'provider' => $this->provider->name(),
            'raw' => $result['raw'],
        ]);
        Setting::put('gold.consecutive_failures', 0);
        Setting::put('gold.last_error', null);
        $this->memo = null;

        return ['ok' => true, 'rate' => $row];
    }

    private function recordFailure(string $message): array
    {
        Log::warning('Gold rate fetch failed: '.$message);
        $failures = (int) Setting::get('gold.consecutive_failures', 0) + 1;
        Setting::put('gold.consecutive_failures', $failures);
        Setting::put('gold.last_error', ['message' => $message, 'at' => now()->toIso8601String()]);

        // Staff email once the API has failed more than 3 consecutive fetches.
        if ($failures === self::FAILURE_ALERT_THRESHOLD + 1 && ($to = AdminNotify::address())) {
            Mail::to($to)->queue(new GoldRateApiFailing($failures, $message, $this->lastGoodApiRate()));
        }

        return ['ok' => false, 'error' => $message];
    }

    public function setSource(string $source): void
    {
        if ($source === 'api' && ! $this->lastGoodApiRate()) {
            throw ValidationException::withMessages(['source' => 'Run "Test & fetch now" successfully before switching to the API rate.']);
        }
        Setting::put('gold.source', $source);
        $this->memo = null;
    }

    public function setManualRate(int $perOzMinor): void
    {
        Setting::put('gold.manual_rate_per_oz', $perOzMinor);
        GoldRate::create(['source' => 'manual', 'rate_per_oz' => $perOzMinor, 'fetched_at' => now()]);
        $this->memo = null;
    }

    /** Status for the admin dashboard and gold-rate screen. */
    public function status(): array
    {
        $current = $this->current();
        $lastApi = $this->lastGoodApiRate();
        $interval = (int) Setting::get('gold.fetch_interval_minutes', 60);
        $ageMinutes = $lastApi ? (int) $lastApi->fetched_at->diffInMinutes(now(), true) : null;
        $failures = (int) Setting::get('gold.consecutive_failures', 0);
        $warning = null;
        if ($this->source() === 'api' && $lastApi && ($failures > 0 || $ageMinutes > 2 * $interval)) {
            $hours = round($ageMinutes / 60, 1);
            $warning = "API rate is {$hours} hours old".($failures ? " ({$failures} failed fetch".($failures > 1 ? 'es' : '').')' : '').'.';
        }

        return [
            'per_oz' => $current['per_oz'],
            'source' => $current['source'],
            'updated_at' => $current['updated_at']?->toIso8601String(),
            'provider' => Setting::get('gold.api_provider', 'goldapi'),
            'fetch_interval_minutes' => $interval,
            'manual_rate_per_oz' => (int) Setting::get('gold.manual_rate_per_oz', 0),
            'last_api_rate' => $lastApi ? ['per_oz' => $lastApi->rate_per_oz, 'fetched_at' => $lastApi->fetched_at->toIso8601String()] : null,
            'api_age_minutes' => $ageMinutes,
            'consecutive_failures' => $failures,
            'last_error' => Setting::get('gold.last_error'),
            'can_use_api' => (bool) $lastApi,
            'api_key_configured' => (bool) config('services.goldapi.key'),
            'warning' => $warning,
        ];
    }

    public function resetMemo(): void
    {
        $this->memo = null;
    }
}
