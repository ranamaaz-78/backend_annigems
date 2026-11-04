<?php

namespace Tests\Feature\Admin;

use App\Mail\OrderStageMail;
use App\Models\ConfigRing;
use App\Models\ConfigRingStone;
use App\Models\ConfigStone;
use App\Models\Order;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use App\Services\OrderService;
use App\Services\Stripe\StripeGateway;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Support\FakeStripeGateway;

class AdminModulesTest extends AdminTestCase
{
    private FakeStripeGateway $stripe;

    private function paidOrder(): Order
    {
        $this->stripe = new FakeStripeGateway;
        $this->app->instance(StripeGateway::class, $this->stripe);
        $user = User::where('email', 'demo@aanigems.com')->first();
        Sanctum::actingAs($user);
        $this->api('POST', 'checkout', [
            'items' => [['type' => 'product', 'product_id' => Product::findBySlugOrLegacy('n1')->id, 'qty' => 1]],
            'address_id' => $user->addresses()->first()->id, 'shipping_method' => 'standard',
        ], ['Idempotency-Key' => 'a'])->assertCreated();
        $order = Order::first();
        app(OrderService::class)->markPaid($order, 'pi_1');
        $this->app['auth']->forgetGuards();

        return $order->refresh();
    }

    public function test_order_stage_flow_refund_and_documents(): void
    {
        Mail::fake();
        $order = $this->paidOrder();
        $this->actingAsStaff('Manager');

        $this->admin('GET', 'orders?status=paid&q=AG-10001')->assertOk()->assertJsonPath('meta.total', 1);
        $this->admin('GET', 'orders/AG-10001')->assertOk()->assertJsonPath('data.next_stage', 'crafting');
        $this->admin('POST', 'orders/AG-10001/stage', ['stage' => 'shipped'])->assertStatus(422); // skipping
        $this->admin('POST', 'orders/AG-10001/stage', ['stage' => 'crafting'])->assertOk()->assertJsonPath('data.stage', 'crafting');
        Mail::assertQueued(OrderStageMail::class, 1);
        $this->admin('POST', 'orders/AG-10001/stage', ['stage' => 'placed'])->assertStatus(422)->assertJsonValidationErrors('note');
        $this->admin('POST', 'orders/AG-10001/stage', ['stage' => 'placed', 'note' => 'Wrong stone'])->assertOk();
        $this->admin('POST', 'orders/AG-10001/stage', ['stage' => 'crafting', 'notify' => false])->assertOk();
        Mail::assertQueued(OrderStageMail::class, 1);
        $this->admin('POST', 'orders/AG-10001/stage', ['stage' => 'quality_check'])->assertOk();
        $this->admin('POST', 'orders/AG-10001/stage', ['stage' => 'shipped'])->assertStatus(422)->assertJsonValidationErrors('tracking_number');
        $this->admin('POST', 'orders/AG-10001/stage', ['stage' => 'shipped', 'carrier' => 'DHL', 'tracking_number' => 'JD0001', 'tracking_url' => 'https://dhl.example/JD0001'])
            ->assertOk()->assertJsonPath('data.tracking_number', 'JD0001');
        $this->admin('POST', 'orders/AG-10001/stage', ['stage' => 'delivered'])->assertOk();
        $this->assertNotNull($order->fresh()->delivered_at);

        $this->admin('POST', 'orders/AG-10001/refund', ['amount' => $order->total + 1])->assertStatus(422);
        $this->admin('POST', 'orders/AG-10001/refund', ['amount' => 500])->assertOk();
        $this->assertSame([['paymentIntentId' => 'pi_1', 'amount' => 500]], $this->stripe->refunds);

        $this->admin('POST', 'orders/AG-10001/notes', ['body' => 'Called the customer'])->assertOk()->assertJsonCount(2, 'data.notes');
        $this->admin('POST', 'orders/AG-10001/resend-confirmation')->assertOk();
        $this->admin('POST', 'orders/AG-10001/cancel')->assertStatus(422); // paid orders cannot be cancelled
        $this->get('/api/v1/admin/orders/AG-10001/invoice')->assertOk()->assertSee('INVOICE')->assertSee('AG-10001');
        $this->get('/api/v1/admin/orders/AG-10001/packing-slip')->assertOk()->assertSee('Packing slip');
        $csv = $this->get('/api/v1/admin/orders-export?status=paid')->assertOk()->streamedContent();
        $this->assertStringContainsString('AG-10001', $csv);
        $this->admin('GET', 'dashboard')->assertOk()->assertJsonPath('data.kpis.paid_orders_total', 1)->assertJsonCount(30, 'data.revenue_chart');
    }

    public function test_customers(): void
    {
        Mail::fake();
        $this->actingAsStaff('Manager');
        $demo = User::where('email', 'demo@aanigems.com')->first();
        $demo->createToken('web:x');
        $this->admin('GET', 'customers?q=demo')->assertOk()->assertJsonPath('data.0.email', 'demo@aanigems.com')->assertJsonMissingPath('data.0.password');
        $this->admin('GET', "customers/{$demo->id}")->assertOk()->assertJsonCount(1, 'data.addresses');
        $this->admin('PUT', "customers/{$demo->id}/active", ['is_active' => false])->assertOk();
        $this->assertSame(0, $demo->tokens()->count());
        $this->admin('POST', "customers/{$demo->id}/reset-code")->assertStatus(422);
        $this->admin('PUT', "customers/{$demo->id}/active", ['is_active' => true])->assertOk();
        $this->admin('POST', "customers/{$demo->id}/reset-code")->assertOk();
    }

    public function test_catalog_crud_with_images(): void
    {
        $this->actingAsStaff('Manager');
        $upload = $this->post('/api/v1/admin/media', ['file' => UploadedFile::fake()->image('ring.jpg'), 'folder' => 'products'])->assertCreated();
        $path = $upload->json('data.path');

        $id = $this->admin('POST', 'products', [
            'category_id' => 1, 'name' => 'Test Ring', 'price' => 123400, 'stock_qty' => 3, 'has_sizes' => true,
            'details' => ['18K', ''], 'tags' => ['new'], 'images' => [['path' => $path], ['path' => 'images/ring1_plain.jpg']],
            'is_active' => true, 'track_stock' => true,
        ])->assertCreated()->assertJsonPath('data.slug', 'test-ring')->assertJsonPath('data.details', ['18K'])
            ->assertJsonCount(2, 'data.images')->json('data.id');
        $this->assertNotEmpty(Product::find($id)->sizes, 'default ring sizes applied');

        $this->admin('PUT', "products/{$id}", ['category_id' => 1, 'name' => 'Test Ring', 'price' => 99900, 'stock_qty' => 3, 'images' => [['path' => 'images/ring1_plain.jpg'], ['path' => $path]]])
            ->assertOk()->assertJsonPath('data.images.0.path', 'images/ring1_plain.jpg');
        $this->api('GET', 'products/test-ring')->assertOk()->assertJsonPath('data.price.amount', 99900);
        $this->admin('POST', 'products', ['name' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['category_id', 'price']);
        $this->admin('DELETE', "products/{$id}")->assertOk();
        $this->api('GET', 'products/test-ring')->assertNotFound();

        $this->admin('POST', 'categories', ['name' => 'Anklets', 'is_active' => true])->assertCreated()->assertJsonPath('data.slug', 'anklets');
        $this->admin('DELETE', 'categories/1')->assertStatus(422);
        $this->admin('POST', 'reviews', ['name' => 'Ana Lopez', 'rating' => 5, 'text' => 'Lovely', 'is_active' => true])->assertCreated()->assertJsonPath('data.initials', 'AL');
    }

    public function test_configurator_admin(): void
    {
        $this->actingAsStaff('Manager');
        $ring = ConfigRing::first();
        $stone = ConfigStone::first();

        $this->admin('PUT', 'configurator/combos', ['ring_id' => $ring->id, 'stone_id' => $stone->id, 'is_active' => false])->assertOk();
        $this->api('GET', 'configurator')->assertJsonCount(7, 'data.combos');
        $this->admin('PUT', 'configurator/combos', ['ring_id' => $ring->id, 'stone_id' => $stone->id, 'is_active' => true, 'image' => '/images/ring2_ruby.jpg'])->assertOk()->assertJsonPath('data.image', 'images/ring2_ruby.jpg');

        $newStone = $this->admin('POST', 'configurator/stones', ['name' => 'Pink Tourmaline', 'price' => 30000, 'color' => '#e91e63', 'is_active' => true])->assertCreated()->json('data.id');
        $this->assertSame(2, ConfigRingStone::where('stone_id', $newStone)->where('is_active', false)->count());

        $this->admin('PUT', "configurator/rings/{$ring->id}", array_merge($ring->only(['name', 'gold_weight_g', 'craft_fee', 'sizes']), ['karat' => 15]))->assertStatus(422);
        $this->admin('PUT', "configurator/rings/{$ring->id}", array_merge($ring->only(['name', 'gold_weight_g', 'craft_fee']), ['karat' => 14, 'sizes' => ['7', '5', '6']]))
            ->assertOk()->assertJsonPath('data.sizes', ['5', '6', '7'])->assertJsonPath('data.gold_value', 14884);

        $this->admin('POST', 'configurator/price-preview', ['ring_id' => $ring->id, 'stone_id' => $stone->id])
            ->assertOk()->assertJsonPath('data.eur.total', 14884 + 18000 + 45000)->assertJsonCount(5, 'data.currencies');
    }

    public function test_pricing_admin(): void
    {
        $this->actingAsStaff('Manager');
        config(['services.goldapi.key' => 'k']);

        $this->admin('PUT', 'pricing/gold', ['source' => 'api'])->assertStatus(422);
        Http::fake(['goldapi.io/*' => Http::response(['price' => 2500, 'currency' => 'EUR'])]);
        $this->admin('POST', 'pricing/gold/fetch')->assertOk()->assertJsonPath('data.ok', true);
        $this->admin('PUT', 'pricing/gold', ['source' => 'api', 'fetch_interval_minutes' => 120])->assertOk()->assertJsonPath('data.status.source', 'api');
        $this->admin('PUT', 'pricing/gold', ['source' => 'manual', 'manual_rate_per_oz' => 255000])->assertOk()->assertJsonPath('data.status.per_oz', 255000);
        $this->admin('GET', 'pricing/gold')->assertOk()->assertJsonPath('data.status.fetch_interval_minutes', 120);

        $this->admin('PUT', 'pricing/currencies/USD', ['manual_rate' => 1.2, 'is_active' => true])->assertOk();
        $this->api('GET', 'products/r1', [], ['X-Currency' => 'USD'])->assertJsonPath('data.price.amount', 95880);
        $this->admin('PUT', 'pricing/currencies/EUR', ['is_active' => false])->assertStatus(422);
        $this->admin('PUT', 'pricing/currencies/settings', ['source' => 'api'])->assertStatus(422);

        $this->admin('PUT', 'pricing/commerce', ['tax_rate' => 0.1, 'free_shipping_threshold' => 100000, 'pending_ttl_hours' => 12])->assertOk();
        $this->assertSame(0.1, Setting::get('tax.rate'));
        $this->admin('POST', 'pricing/shipping-methods', ['code' => 'pickup', 'name' => 'Store pickup', 'price' => 0, 'is_active' => true])->assertCreated();
        $this->admin('POST', 'pricing/countries', ['code' => 'ch', 'name' => 'Switzerland', 'is_active' => true])->assertCreated()->assertJsonPath('data.code', 'CH');

        $this->admin('POST', 'coupons', ['code' => 'gold20', 'type' => 'percent', 'value' => 120])->assertStatus(422);
        $this->admin('POST', 'coupons', ['code' => 'gold20', 'type' => 'percent', 'value' => 20, 'is_active' => true, 'per_user_limit' => 1])
            ->assertCreated()->assertJsonPath('data.code', 'GOLD20')->assertJsonPath('data.stats.paid_orders', 0);
    }
}
