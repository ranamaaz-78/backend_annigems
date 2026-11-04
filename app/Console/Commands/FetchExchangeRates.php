<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Services\CurrencyService;
use Illuminate\Console\Command;

class FetchExchangeRates extends Command
{
    protected $signature = 'rates:fx {--force : Fetch even if the interval has not elapsed or the source is manual}';

    protected $description = 'Fetch EUR exchange rates (only when fx.source = api, every fx.fetch_interval_minutes)';

    public function handle(CurrencyService $fx): int
    {
        if (! $this->option('force')) {
            if ($fx->source() !== 'api') {
                return self::SUCCESS;
            }
            $last = Setting::get('fx.last_attempt_at');
            $interval = max(15, (int) Setting::get('fx.fetch_interval_minutes', 720));
            if ($last && now()->diffInMinutes($last, true) < $interval - 0.5) {
                return self::SUCCESS;
            }
        }

        Setting::put('fx.last_attempt_at', now()->toIso8601String());
        $result = $fx->fetchFromApi();
        $result['ok'] ? $this->info('Exchange rates updated.') : $this->error('FX fetch failed: '.$result['error']);

        return self::SUCCESS;
    }
}
