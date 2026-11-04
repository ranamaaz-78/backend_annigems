<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Services\GoldRateService;
use Illuminate\Console\Command;

class FetchGoldRate extends Command
{
    protected $signature = 'rates:gold {--force : Fetch even if the interval has not elapsed or the source is manual}';

    protected $description = 'Fetch the gold rate from the API provider (only when gold.source = api, every gold.fetch_interval_minutes)';

    public function handle(GoldRateService $gold): int
    {
        if (! $this->option('force')) {
            if ($gold->source() !== 'api') {
                return self::SUCCESS; // manual selected: do not spend the provider quota
            }
            $last = Setting::get('gold.last_attempt_at');
            $interval = max(5, (int) Setting::get('gold.fetch_interval_minutes', 60));
            if ($last && now()->diffInMinutes($last, true) < $interval - 0.5) {
                return self::SUCCESS;
            }
        }

        Setting::put('gold.last_attempt_at', now()->toIso8601String());
        $result = $gold->fetchFromApi();
        $result['ok']
            ? $this->info('Gold rate: €'.number_format($result['rate']->rate_per_oz / 100, 2).'/oz')
            : $this->error('Gold rate fetch failed: '.$result['error']);

        return self::SUCCESS;
    }
}
