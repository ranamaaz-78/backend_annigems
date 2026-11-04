<?php

namespace Tests\Feature\Store;

use App\Models\ConfigRing;
use App\Models\ConfigStone;
use App\Models\Coupon;
use App\Models\ExchangeRate;
use App\Models\Setting;
use App\Models\ShippingMethod;
use App\Services\CurrencyService;
use App\Services\PricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PricingServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedStore();
    }

    private function aurora(): ConfigRing
    {
        return ConfigRing::where('slug', 'aurora-solitaire')->first();
    }

    private function ruby(): ConfigStone
    {
        return ConfigStone::where('slug', 'ruby')->first();
    }

    public function test_brief_example_aurora_ruby_at_2480(): void
    {
        $p = app(PricingService::class)->configuratorPriceEur($this->aurora(), $this->ruby(), 248000);
        $this->assertSame(19136, $p['gold_value']);   // €191.36
        $this->assertSame(37136, $p['ring_charge']);  // + €180 craft
        $this->assertSame(82136, $p['total']);        // + €450 ruby = €821.36
    }

    public function test_uses_current_manual_gold_rate(): void
    {
        $p = app(PricingService::class)->configuratorPriceEur($this->aurora(), $this->ruby());
        $this->assertSame(248000, $p['gold_rate_per_oz']);
        $this->assertSame(82136, $p['total']);
    }

    public function test_karat_purity_changes_gold_value(): void
    {
        $ring = $this->aurora();
        $ring->karat = 14;
        $p = app(PricingService::class)->configuratorPriceEur($ring, null, 248000);
        // 3.2 × 14/24 × 2480/31.1034768 = 148.836… → €148.84
        $this->assertSame(14884, $p['gold_value']);
        $ring->karat = 24;
        $this->assertSame(25515, app(PricingService::class)->configuratorPriceEur($ring, null, 248000)['gold_value']);
    }

    public function test_currency_conversion_converts_components_first(): void
    {
        ExchangeRate::create(['currency_code' => 'USD', 'rate' => 1.1, 'source' => 'manual', 'fetched_at' => now()->addMinute()]);
        app(CurrencyService::class)->resetMemo();
        $p = app(PricingService::class)->configuratorPrice($this->aurora(), $this->ruby(), 'USD');
        $this->assertSame(21050, $p['gold_value']);  // round(19136 × 1.1) = 21049.6
        $this->assertSame(19800, $p['craft_fee']);
        $this->assertSame(49500, $p['stone_price']);
        $this->assertSame(21050 + 19800 + 49500, $p['total']);
        $this->assertSame(82136, $p['eur']['total']);
    }

    public function test_totals_percent_coupon_free_shipping_and_tax(): void
    {
        $pricing = app(PricingService::class);
        $standard = ShippingMethod::where('code', 'standard')->first();
        $coupon = Coupon::where('code', 'AANI10')->first();

        // €799 subtotal, 10% → €79.90 off, taxable €719.10 ≥ €500 → free standard shipping, tax 8%.
        $t = $pricing->totals(79900, $coupon, $standard, 'EUR');
        $this->assertSame(7990, $t['discount']);
        $this->assertSame(71910, $t['taxable']);
        $this->assertSame(0, $t['shipping']);
        $this->assertSame(5753, $t['tax']); // 719.10 × 0.08 = 57.528
        $this->assertSame(71910 + 5753, $t['total']);

        // Threshold applies to the taxable amount (after discount): €540 − 10% = €486 < €500 → €25 shipping.
        $t = $pricing->totals(54000, $coupon, $standard, 'EUR');
        $this->assertSame(2500, $t['shipping']);
        // Express is never free.
        $this->assertSame(4500, $pricing->totals(100000, null, ShippingMethod::where('code', 'express')->first(), 'EUR')['shipping']);
    }

    public function test_fixed_coupon_never_exceeds_subtotal_and_is_converted(): void
    {
        $fixed = Coupon::create(['code' => 'TENOFF', 'type' => 'fixed', 'value' => 1000, 'is_active' => true]);
        $pricing = app(PricingService::class);
        $this->assertSame(1000, $pricing->discount(5000, $fixed, 'EUR'));
        $this->assertSame(500, $pricing->discount(500, $fixed, 'EUR'));
        $rate = (float) ExchangeRate::where('currency_code', 'INR')->value('rate');
        $this->assertSame((int) round(1000 * $rate), $pricing->discount(10_000_000, $fixed, 'INR'));
        Setting::flush();
    }
}
