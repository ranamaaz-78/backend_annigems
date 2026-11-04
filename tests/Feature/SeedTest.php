<?php

namespace Tests\Feature;

use App\Models\ConfigRing;
use App\Models\ConfigRingStone;
use App\Models\ContentBlock;
use App\Models\Coupon;
use App\Models\Faq;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SeedTest extends TestCase
{
    use RefreshDatabase;

    public function test_storefront_seed_loads_everything(): void
    {
        Storage::fake('public');
        $this->seed();

        $this->assertSame(12, Product::count());
        $r1 = Product::findBySlugOrLegacy('r1');
        $this->assertSame(79900, $r1->price);
        $this->assertTrue($r1->has_sizes);
        $this->assertSame(0, Product::findBySlugOrLegacy('r6')->stock_qty);
        $this->assertSame(149000, Product::findBySlugOrLegacy('r2')->compare_at_price);

        $this->assertSame(8, ConfigRingStone::count());
        $aurora = ConfigRing::where('slug', 'aurora-solitaire')->first();
        $this->assertSame(18, $aurora->karat);
        $this->assertSame(18000, $aurora->craft_fee);
        $this->assertContains('6.5', $aurora->sizes);

        $this->assertSame(['VISA', 'MC', 'AMEX'], ContentBlock::value('payment_badges'));
        $this->assertSame('manual', Setting::get('gold.source'));
        $this->assertSame(248000, Setting::get('gold.manual_rate_per_oz'));
        $this->assertSame(50000, Setting::get('shipping.free_threshold'));
        $this->assertStringContainsString('via Stripe', Faq::where('question', 'Which payment methods do you accept?')->value('answer'));
        $this->assertSame(['AANI10', 'WELCOME15'], Coupon::orderBy('code')->pluck('code')->all());
        $this->assertTrue(User::where('email', 'demo@aanigems.com')->exists());
        Storage::disk('public')->assertExists('images/ring1_ruby.jpg');
    }
}
