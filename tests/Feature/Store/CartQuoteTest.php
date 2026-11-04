<?php

namespace Tests\Feature\Store;

use App\Models\ConfigRing;
use App\Models\ConfigRingStone;
use App\Models\ConfigStone;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CartQuoteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedStore();
    }

    private function p(string $legacy): Product
    {
        return Product::findBySlugOrLegacy($legacy);
    }

    public function test_quote_prices_products_and_custom_rings(): void
    {
        $ring = ConfigRing::where('slug', 'aurora-solitaire')->first();
        $ruby = ConfigStone::where('slug', 'ruby')->first();

        $res = $this->api('POST', 'cart/quote', [
            'items' => [
                ['type' => 'product', 'product_id' => $this->p('n1')->id, 'qty' => 2, 'price' => 1],
                ['type' => 'custom_ring', 'ring_id' => $ring->id, 'stone_id' => $ruby->id, 'size' => '6.5', 'qty' => 1],
            ],
            'coupon_code' => 'aani10',
            'shipping_method' => 'express',
            'total' => 1, // ignored: the server prices everything
        ])->assertOk();

        $res->assertJsonPath('data.valid', true)
            ->assertJsonPath('data.lines.0.unit_price.amount', 85000)
            ->assertJsonPath('data.lines.0.line_total.amount', 170000)
            ->assertJsonPath('data.lines.1.unit_price.amount', 82136)
            ->assertJsonPath('data.lines.1.breakdown.gold_value.formatted', '€191.36')
            ->assertJsonPath('data.coupon.valid', true)
            ->assertJsonPath('data.totals.subtotal.amount', 252136)
            ->assertJsonPath('data.totals.discount.amount', 25214)
            ->assertJsonPath('data.totals.shipping.amount', 4500)
            ->assertJsonPath('data.totals.tax.amount', 18154) // (252136-25214) × 0.08 = 18153.76
            ->assertJsonPath('data.totals.total.amount', 252136 - 25214 + 4500 + 18154)
            ->assertJsonPath('data.gold_rate.source', 'manual')
            ->assertJsonPath('meta.currency', 'EUR');
    }

    public function test_quote_rejects_invalid_lines(): void
    {
        $r1 = $this->p('r1');
        $r2 = $this->p('r2');
        $r2->update(['is_active' => false]);
        $ring = ConfigRing::where('slug', 'aurora-solitaire')->first();
        $ruby = ConfigStone::where('slug', 'ruby')->first();
        ConfigRingStone::where('ring_id', $ring->id)->where('stone_id', $ruby->id)->update(['is_active' => false]);

        $res = $this->api('POST', 'cart/quote', ['items' => [
            ['type' => 'product', 'product_id' => $r1->id, 'qty' => 1, 'size' => '99'],                 // invalid size
            ['type' => 'product', 'product_id' => $r1->id, 'qty' => 1],                                  // size missing
            ['type' => 'product', 'product_id' => $r2->id, 'qty' => 1, 'size' => '7'],                   // inactive
            ['type' => 'product', 'product_id' => $this->p('r6')->id, 'qty' => 1, 'size' => '7'],        // out of stock (seed)
            ['type' => 'custom_ring', 'ring_id' => $ring->id, 'stone_id' => $ruby->id, 'size' => '7', 'qty' => 1], // combo off
            ['type' => 'product', 'product_id' => 999999, 'qty' => 1],
            ['type' => 'product', 'product_id' => $this->p('n1')->id, 'qty' => 1],
        ]])->assertOk();

        $res->assertJsonPath('data.valid', false)
            ->assertJsonPath('data.lines.0.errors', ['invalid_size'])
            ->assertJsonPath('data.lines.1.errors', ['invalid_size'])
            ->assertJsonPath('data.lines.2.errors', ['inactive'])
            ->assertJsonPath('data.lines.3.errors', ['out_of_stock'])
            ->assertJsonPath('data.lines.4.errors', ['combo_unavailable'])
            ->assertJsonPath('data.lines.5.errors', ['not_found'])
            ->assertJsonPath('data.lines.6.available', true)
            // Only the valid line counts in the totals.
            ->assertJsonPath('data.totals.subtotal.amount', 85000);
    }

    public function test_out_of_stock_counts_quantity_across_lines(): void
    {
        $n1 = $this->p('n1');
        $n1->update(['stock_qty' => 2]);
        $this->api('POST', 'cart/quote', ['items' => [
            ['type' => 'product', 'product_id' => $n1->id, 'qty' => 2],
            ['type' => 'product', 'product_id' => $n1->id, 'qty' => 1],
        ]])->assertJsonPath('data.lines.0.available', true)->assertJsonPath('data.lines.1.errors', ['out_of_stock']);
    }

    public function test_inactive_ring_or_stone_disables_combo_and_invalid_coupon_message(): void
    {
        $ring = ConfigRing::where('slug', 'aurora-solitaire')->first();
        $stone = ConfigStone::where('slug', 'sapphire')->first();
        $stone->update(['is_active' => false]);

        $this->api('POST', 'cart/quote', [
            'items' => [['type' => 'custom_ring', 'ring_id' => $ring->id, 'stone_id' => $stone->id, 'size' => '7', 'qty' => 1]],
            'coupon_code' => 'NOPE',
        ])->assertJsonPath('data.lines.0.errors', ['combo_unavailable'])
            ->assertJsonPath('data.coupon.valid', false)
            ->assertJsonPath('data.coupon.message', 'This coupon code is not valid.');

        $this->api('POST', 'configurator/price', ['ring_id' => $ring->id, 'stone_id' => $stone->id, 'size' => '7'])
            ->assertStatus(422)->assertJsonValidationErrors('stone_id');
    }

    public function test_free_shipping_threshold_uses_currency(): void
    {
        $this->api('POST', 'cart/quote', ['items' => [['type' => 'product', 'product_id' => $this->p('n1')->id, 'qty' => 1]], 'shipping_method' => 'standard'], ['X-Currency' => 'USD'])
            ->assertJsonPath('meta.currency', 'USD')
            ->assertJsonPath('data.totals.shipping.amount', 0)
            ->assertJsonPath('data.shipping_options.0.is_free', true);
    }

    public function test_store_endpoints(): void
    {
        $this->api('GET', 'bootstrap')->assertOk()
            ->assertJsonPath('data.payment_badges', ['VISA', 'MC', 'AMEX'])
            ->assertJsonPath('data.free_shipping_threshold.amount', 50000)
            ->assertJsonMissingPath('data.app');
        $this->api('GET', 'bootstrap', platform: 'mobile')->assertOk()->assertJsonStructure(['data' => ['app' => ['ios', 'android', 'maintenance']]]);
        $this->api('GET', 'home')->assertOk()->assertJsonCount(5, 'data.featured_products')->assertJsonPath('data.categories.0.count', 6);
        $this->api('GET', 'products?category=rings&per_page=50')->assertOk()->assertJsonCount(6, 'data');
        $this->api('GET', 'products?stone[]=Ruby')->assertOk()->assertJsonCount(2, 'data');
        $this->api('GET', 'products?max_price=80000&sort=price-asc')->assertOk()->assertJsonPath('data.0.legacy_id', 'n2');
        $this->api('GET', 'products/r1')->assertOk()->assertJsonCount(4, 'data.gallery')->assertJsonCount(4, 'data.related');
        $this->api('GET', 'products/aurora-solitaire')->assertOk()->assertJsonPath('data.legacy_id', 'r1');
        $this->api('GET', 'products/nope')->assertNotFound();
        $this->api('GET', 'configurator')->assertOk()->assertJsonCount(8, 'data.combos')
            ->assertJsonPath('data.rings.0.ring_charge.amount', 37136);
        $this->api('GET', 'pages/warranty')->assertOk()->assertJsonPath('data.title', 'Warranty & Lifetime Care');
        $this->api('GET', 'faqs')->assertOk()->assertJsonCount(4, 'data');
        $this->api('GET', 'search?q=ruby')->assertOk();
        $this->api('POST', 'contact', ['name' => 'A', 'email' => 'a@b.co', 'topic' => 'Other', 'message' => 'Hello there'])->assertCreated();
        $this->api('POST', 'contact', ['name' => 'A', 'email' => 'bad', 'message' => ''])->assertStatus(422)->assertJsonValidationErrors(['email', 'message']);
        $this->api('POST', 'newsletter', ['email' => 'A@B.co'])->assertCreated();
        $this->api('POST', 'newsletter', ['email' => 'a@b.co'])->assertOk();
    }
}
