<?php

namespace Tests\Feature\Store;

use App\Mail\GoldRateApiFailing;
use App\Models\Currency;
use App\Models\GoldRate;
use App\Models\Setting;
use App\Services\CurrencyService;
use App\Services\GoldRateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class RateSourcesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedStore();
        config(['services.goldapi.key' => 'test-key']);
    }

    public function test_manual_source_used_by_default(): void
    {
        $gold = app(GoldRateService::class);
        $this->assertSame('manual', $gold->current()['source']);
        $this->assertSame(248000, $gold->perOz());
    }

    public function test_cannot_switch_gold_to_api_without_successful_fetch(): void
    {
        Http::fake(['goldapi.io/*' => Http::response('quota exceeded', 429)]);
        $gold = app(GoldRateService::class);
        $this->assertFalse($gold->fetchFromApi()['ok']);

        $this->expectException(ValidationException::class);
        $gold->setSource('api');
    }

    public function test_api_source_used_and_last_good_rate_kept_on_failure(): void
    {
        Mail::fake();
        Http::fakeSequence('goldapi.io/*')
            ->push(['price' => 2600.55, 'currency' => 'EUR', 'metal' => 'XAU'])
            ->pushStatus(500)->pushStatus(500)->pushStatus(500)->pushStatus(500);

        $gold = app(GoldRateService::class);
        $this->assertTrue($gold->fetchFromApi()['ok']);
        $gold->setSource('api');
        $this->assertSame(260055, $gold->perOz());
        $this->assertSame('api', $gold->current()['source']);

        // Provider fails: still the last good API rate, never the manual one (no automatic switching).
        foreach (range(1, 4) as $i) {
            $this->assertFalse($gold->fetchFromApi()['ok']);
        }
        $gold->resetMemo();
        $this->assertSame(260055, $gold->perOz());
        $this->assertSame('api', Setting::get('gold.source'));
        $this->assertSame(4, Setting::get('gold.consecutive_failures'));
        $this->assertNotNull($gold->status()['warning']);
        Mail::assertQueued(GoldRateApiFailing::class, 1);

        // Manual selected again → manual rate, even though API rates exist.
        $gold->setSource('manual');
        $this->assertSame(248000, $gold->perOz());
    }

    public function test_manual_rate_change_is_recorded(): void
    {
        app(GoldRateService::class)->setManualRate(250000);
        $this->assertSame(250000, app(GoldRateService::class)->perOz());
        $this->assertSame(2, GoldRate::where('source', 'manual')->count());
    }

    public function test_fx_source_rules(): void
    {
        $fx = app(CurrencyService::class);
        $manualUsd = $fx->rate('USD');

        Http::fakeSequence('open.er-api.com/*')
            ->push(['result' => 'error'], 500)
            ->push(['result' => 'success', 'rates' => ['USD' => 1.2, 'INR' => 95.5, 'AED' => 4.1, 'GBP' => 0.86, 'EUR' => 1]])
            ->push('down', 503);
        $this->assertFalse($fx->fetchFromApi()['ok']);
        try {
            $fx->setSource('api');
            $this->fail('Switching to api without a successful fetch must fail.');
        } catch (ValidationException) {
        }

        $this->assertTrue($fx->fetchFromApi()['ok']);
        $this->assertSame($manualUsd, $fx->rate('USD'), 'manual stays selected after a fetch');
        $fx->setSource('api');
        $this->assertSame(1.2, $fx->rate('USD'));

        // Provider down: last good API rates kept.
        $this->assertFalse($fx->fetchFromApi()['ok']);
        $fx->resetMemo();
        $this->assertSame(1.2, $fx->rate('USD'));
    }

    public function test_unknown_or_disabled_currency_falls_back_to_eur(): void
    {
        $this->api('GET', 'products/r1', [], ['X-Currency' => 'JPY'])
            ->assertOk()->assertJsonPath('meta.currency', 'EUR')->assertJsonPath('data.price.formatted', '€799.00');

        Currency::where('code', 'GBP')->update(['is_active' => false]);
        $this->api('GET', 'products/r1', [], ['X-Currency' => 'GBP'])->assertJsonPath('meta.currency', 'EUR');
        $this->api('GET', 'products/r1', [], ['X-Currency' => 'usd'])->assertJsonPath('meta.currency', 'USD')
            ->assertJsonPath('data.price.currency', 'USD');
    }
}
