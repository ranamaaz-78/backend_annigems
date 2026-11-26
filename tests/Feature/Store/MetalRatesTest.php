<?php

namespace Tests\Feature\Store;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MetalRatesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_feed_converts_to_currency_and_tracks_daily_change(): void
    {
        $this->travelTo(now('UTC')->setTime(10, 0));
        Http::fake([
            '*/XAU' => Http::sequence()->push(['price' => 3000])->push(['price' => 3030])->push('down', 500),
            '*/XAG' => Http::sequence()->push(['price' => 40])->push(['price' => 40])->push('down', 500),
        ]);

        $this->withHeader('X-Currency', 'USD')->getJson('/api/v1/web/metal-rates')
            ->assertOk()
            ->assertJsonPath('data.metals.0.per_oz.currency', 'USD')
            ->assertJsonPath('data.metals.0.per_oz.amount', 300000)
            ->assertJsonPath('data.metals.1.name', 'Silver');

        $this->travel(2)->minutes();
        $second = $this->withHeader('X-Currency', 'USD')->getJson('/api/v1/web/metal-rates');
        $this->assertEquals(1.0, $second->json('data.metals.0.change_percent'));

        // Provider failing: the last good reading keeps being served.
        $this->travel(2)->minutes();
        $this->withHeader('X-Currency', 'USD')->getJson('/api/v1/web/metal-rates')
            ->assertJsonPath('data.metals.0.per_oz.amount', 303000);
    }

    public function test_feed_is_null_when_provider_never_answered(): void
    {
        Http::fake(['*' => Http::response('down', 500)]);

        $this->getJson('/api/v1/web/metal-rates')->assertOk()->assertJsonPath('data', null);
    }
}
