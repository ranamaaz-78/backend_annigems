<?php

namespace Database\Seeders;

use App\Models\Currency;
use App\Models\ExchangeRate;
use App\Models\GoldRate;
use App\Models\Setting;
use Illuminate\Database\Seeder;

/** EUR base + USD, INR, AED, GBP with manual starter rates; initial manual gold rate row. */
class CurrencySeeder extends Seeder
{
    public function run(): void
    {
        $currencies = [
            ['EUR', '€', 'Euro', 1.0],
            ['USD', '$', 'US Dollar', 1.08],
            ['INR', '₹', 'Indian Rupee', 90.50],
            ['AED', 'AED', 'UAE Dirham', 3.97],
            ['GBP', '£', 'British Pound', 0.85],
        ];
        foreach ($currencies as $i => [$code, $symbol, $name, $rate]) {
            Currency::updateOrCreate(['code' => $code], [
                'symbol' => $symbol, 'name' => $name, 'decimals' => 2,
                'is_base' => $code === 'EUR', 'is_active' => true, 'sort_order' => $i + 1,
            ]);
            if ($code !== 'EUR' && ! ExchangeRate::where('currency_code', $code)->where('source', 'manual')->exists()) {
                ExchangeRate::create(['currency_code' => $code, 'rate' => $rate, 'source' => 'manual', 'fetched_at' => now()]);
            }
        }

        if (! GoldRate::where('source', 'manual')->exists()) {
            GoldRate::create([
                'source' => 'manual',
                'rate_per_oz' => (int) Setting::get('gold.manual_rate_per_oz', 248000),
                'fetched_at' => now(),
                'provider' => null,
            ]);
        }
    }
}
