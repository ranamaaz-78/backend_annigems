<?php

namespace Tests\Feature\Orders;

use App\Mail\NewPaidOrder;
use App\Mail\OrderConfirmedMail;
use App\Mail\PaymentFailedMail;
use App\Mail\RefundIssuedMail;
use App\Models\ConfigRing;
use App\Models\ConfigStone;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\Product;
use App\Models\StripeEvent;
use App\Models\User;
use App\Services\Stripe\StripeGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Support\FakeStripeGateway;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private FakeStripeGateway $stripe;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedStore();
        Mail::fake();
        config(['services.admin_notify' => 'ops@aanigems.com', 'services.stripe.key' => 'pk_test_123']);
        $this->stripe = new FakeStripeGateway;
        $this->app->instance(StripeGateway::class, $this->stripe);
        $this->user = User::where('email', 'demo@aanigems.com')->first();
        Sanctum::actingAs($this->user);
    }

    private function payload(array $over = []): array
    {
        $ring = ConfigRing::where('slug', 'aurora-solitaire')->first();
        $ruby = ConfigStone::where('slug', 'ruby')->first();

        return $over + [
            'items' => [
                ['type' => 'product', 'product_id' => Product::findBySlugOrLegacy('r1')->id, 'size' => '7', 'qty' => 2],
                ['type' => 'custom_ring', 'ring_id' => $ring->id, 'stone_id' => $ruby->id, 'size' => '6.5', 'qty' => 1],
            ],
            'address_id' => $this->user->addresses()->first()->id,
            'shipping_method' => 'express',
            'coupon_code' => 'AANI10',
            'customer_note' => 'Gift wrap please',
        ];
    }

    private function checkout(array $payload, string $key = 'key-1', string $platform = 'web')
    {
        return $this->api('POST', 'checkout', $payload, ['Idempotency-Key' => $key], $platform);
    }

    private function webhook(string $id, string $type, array $object)
    {
        return $this->postJson('/api/v1/webhooks/stripe', ['id' => $id, 'type' => $type, 'data' => ['object' => $object]], ['Stripe-Signature' => 'valid']);
    }

    public function test_checkout_creates_pending_order_with_snapshots_and_payment_intent(): void
    {
        $res = $this->checkout($this->payload())->assertCreated();
        $res->assertJsonPath('data.order.status', 'pending_payment')
            ->assertJsonPath('data.order.number', 'AG-10001')
            ->assertJsonPath('data.payment.client_secret', 'pi_1_secret_1')
            ->assertJsonPath('data.payment.publishable_key', 'pk_test_123')
            ->assertJsonMissingPath('data.payment.ephemeral_key');

        $order = Order::with('items')->first();
        // 2 × €799 + €821.36 = €2,419.36; −10% = €241.94; express €45; tax 8% of €2,177.42 = €174.19
        $this->assertSame(241936, $order->subtotal);
        $this->assertSame(24194, $order->discount);
        $this->assertSame(4500, $order->shipping);
        $this->assertSame(17419, $order->tax);
        $this->assertSame(241936 - 24194 + 4500 + 17419, $order->total);
        $this->assertSame($order->total, $order->total_eur);
        $this->assertSame('EUR', $order->currency);
        $this->assertSame('AANI10', $order->coupon_snapshot['code']);
        $this->assertSame('Mumbai', $order->ship_city);
        $this->assertSame('India', $order->ship_country);
        $this->assertSame('web', $order->placed_from);
        $this->assertSame('pi_1', $order->stripe_payment_intent_id);

        $ringItem = $order->items->firstWhere('kind', 'custom_ring');
        $this->assertSame(82136, $ringItem->unit_price);
        $this->assertSame(19136, $ringItem->snapshot['gold_value_eur']);
        $this->assertSame(248000, $ringItem->snapshot['gold_rate_per_oz_eur']);
        $this->assertSame('manual', $ringItem->snapshot['gold_rate_source']);
        $this->assertSame(18, $ringItem->snapshot['karat']);
        $this->assertSame('6.5', $ringItem->size);
        $this->assertSame('18K Gold', $order->items->firstWhere('kind', 'product')->snapshot['metal']);

        // Snapshots do not change when prices change later.
        Product::findBySlugOrLegacy('r1')->update(['price' => 1]);
        $this->api('GET', 'orders/AG-10001')->assertOk()->assertJsonPath('data.items.0.unit_price.amount', 79900)
            ->assertJsonCount(5, 'data.timeline')->assertJsonPath('data.timeline.0.label', 'Order Placed');
        $this->api('GET', 'orders')->assertOk()->assertJsonPath('data.0.number', 'AG-10001');
    }

    public function test_checkout_in_other_currency_and_mobile_payload(): void
    {
        $res = $this->api('POST', 'checkout', $this->payload(['coupon_code' => null]), ['Idempotency-Key' => 'm-1', 'X-Currency' => 'GBP'], 'mobile')->assertCreated();
        $res->assertJsonPath('data.order.currency', 'GBP')
            ->assertJsonPath('data.payment.customer_id', 'cus_'.$this->user->id)
            ->assertJsonPath('data.payment.ephemeral_key', 'ek_test_cus_'.$this->user->id);
        $order = Order::first();
        $this->assertSame('mobile', $order->placed_from);
        $this->assertSame('gbp', $this->stripe->intents['pi_1']['currency']);
        $this->assertSame($order->total, $this->stripe->intents['pi_1']['amount']);
        // Line totals add up in the order currency.
        $this->assertSame($order->items->sum('line_total'), $order->subtotal);
    }

    public function test_idempotency_key(): void
    {
        $this->api('POST', 'checkout', $this->payload())->assertStatus(422)->assertJsonValidationErrors('idempotency_key');
        $this->checkout($this->payload())->assertCreated();
        $this->checkout($this->payload())->assertOk()->assertJsonPath('data.order.number', 'AG-10001');
        $this->assertSame(1, Order::count());
        $this->checkout($this->payload(['customer_note' => 'changed']))->assertStatus(409);
        $this->checkout($this->payload(), 'key-2')->assertCreated()->assertJsonPath('data.order.number', 'AG-10002');
    }

    public function test_checkout_validation(): void
    {
        $p = $this->payload();
        $p['items'][0]['size'] = '99';
        $this->checkout($p)->assertStatus(422)->assertJsonValidationErrors('items.0');

        $this->checkout($this->payload(['coupon_code' => 'NOPE']), 'k2')->assertStatus(422)->assertJsonValidationErrors('coupon_code');
        $this->checkout($this->payload(['shipping_method' => 'teleport']), 'k3')->assertStatus(422)->assertJsonValidationErrors('shipping_method');

        $inline = $this->payload(['address_id' => null, 'address' => ['name' => 'Gia', 'line1' => 'Via Roma 1', 'city' => 'Milano', 'zip' => '20100', 'country_code' => 'IT'], 'save_address' => true]);
        $this->checkout($inline, 'k4')->assertCreated();
        $this->assertSame(2, $this->user->addresses()->count());
        $inline['address']['country_code'] = 'JP';
        $this->checkout($inline, 'k5')->assertStatus(422)->assertJsonValidationErrors('address.country_code');
        $this->assertSame(1, Order::count());
    }

    public function test_webhook_succeeded_marks_paid_once(): void
    {
        $this->checkout($this->payload())->assertCreated();
        $order = Order::first();
        $stockBefore = Product::findBySlugOrLegacy('r1')->stock_qty;
        $usedBefore = Coupon::where('code', 'AANI10')->value('used_count');
        $pi = ['id' => 'pi_1', 'object' => 'payment_intent', 'metadata' => ['order_id' => (string) $order->id]];

        $this->webhook('evt_1', 'payment_intent.succeeded', $pi)->assertOk();
        $this->webhook('evt_1', 'payment_intent.succeeded', $pi)->assertOk()->assertJsonPath('duplicate', true);
        $this->webhook('evt_2', 'payment_intent.succeeded', $pi)->assertOk(); // another event for the same PI

        $order->refresh();
        $this->assertSame('paid', $order->status);
        $this->assertSame('placed', $order->stage);
        $this->assertNotNull($order->paid_at);
        $this->assertSame($stockBefore - 2, Product::findBySlugOrLegacy('r1')->stock_qty);
        $this->assertSame($usedBefore + 1, Coupon::where('code', 'AANI10')->value('used_count'));
        $this->assertSame(2, StripeEvent::count());
        Mail::assertQueued(OrderConfirmedMail::class, 1);
        Mail::assertQueued(NewPaidOrder::class, 1);

        $this->api('GET', 'orders/AG-10001')->assertJsonPath('data.status', 'paid')->assertJsonPath('data.timeline.0.done', true);
        $this->api('POST', 'orders/AG-10001/cancel')->assertStatus(422);
        $this->api('POST', 'orders/AG-10001/pay')->assertStatus(422);
    }

    public function test_stock_issue_flag_instead_of_failure(): void
    {
        $this->checkout($this->payload())->assertCreated();
        Product::findBySlugOrLegacy('r1')->update(['stock_qty' => 1]);
        $order = Order::first();
        $this->webhook('evt_1', 'payment_intent.succeeded', ['id' => 'pi_1', 'object' => 'payment_intent', 'metadata' => ['order_id' => $order->id]])->assertOk();
        $this->assertTrue($order->fresh()->stock_issue);
        $this->assertSame('paid', $order->fresh()->status);
        $this->assertSame(-1, Product::findBySlugOrLegacy('r1')->stock_qty);
    }

    public function test_webhook_failed_then_retry_and_cancel(): void
    {
        $this->checkout($this->payload())->assertCreated();
        $order = Order::first();
        $this->webhook('evt_f', 'payment_intent.payment_failed', ['id' => 'pi_1', 'object' => 'payment_intent', 'metadata' => ['order_id' => $order->id], 'last_payment_error' => ['message' => 'Your card was declined.']])->assertOk();
        $this->assertSame('payment_failed', $order->fresh()->status);
        Mail::assertQueued(PaymentFailedMail::class);

        // Retry: the failed PI is not reusable → a fresh one, same snapshotted total.
        $this->stripe->intents['pi_1']['status'] = 'canceled';
        Product::findBySlugOrLegacy('r1')->update(['price' => 5]);
        $this->api('POST', 'orders/AG-10001/pay')->assertOk()
            ->assertJsonPath('data.payment.client_secret', 'pi_2_secret_2')
            ->assertJsonPath('data.order.total.amount', $order->total);
        $this->assertSame($order->total, $this->stripe->intents['pi_2']['amount']);

        // Retry while the PI is still usable reuses it.
        $this->api('POST', 'orders/AG-10001/pay')->assertOk()->assertJsonPath('data.payment.client_secret', 'pi_2_secret_2');

        // Retry re-validates stock.
        Product::findBySlugOrLegacy('r1')->update(['stock_qty' => 0]);
        $this->api('POST', 'orders/AG-10001/pay')->assertStatus(422);

        $this->api('POST', 'orders/AG-10001/cancel')->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertContains('pi_2', $this->stripe->cancelled);
    }

    public function test_refund_webhook(): void
    {
        $this->checkout($this->payload())->assertCreated();
        $order = Order::first();
        $this->webhook('evt_1', 'payment_intent.succeeded', ['id' => 'pi_1', 'object' => 'payment_intent', 'metadata' => ['order_id' => $order->id]]);

        $this->webhook('evt_r1', 'charge.refunded', ['id' => 'ch_1', 'object' => 'charge', 'payment_intent' => 'pi_1', 'amount_refunded' => 1000]);
        $this->assertSame('partially_refunded', $order->fresh()->status);
        $this->assertSame(1000, $order->fresh()->refunded_amount);
        $this->webhook('evt_r2', 'charge.refunded', ['id' => 'ch_1', 'object' => 'charge', 'payment_intent' => 'pi_1', 'amount_refunded' => $order->total]);
        $this->assertSame('refunded', $order->fresh()->status);
        Mail::assertQueued(RefundIssuedMail::class, 2);
    }

    public function test_invalid_signature_and_stripe_outage(): void
    {
        $this->postJson('/api/v1/webhooks/stripe', ['id' => 'x', 'type' => 'payment_intent.succeeded'], ['Stripe-Signature' => 'forged'])->assertStatus(400);

        $this->stripe->failCreate = true;
        $this->checkout($this->payload())->assertStatus(502);
        // The order exists and can be paid later.
        $this->assertSame('pending_payment', Order::first()->status);
        $this->stripe->failCreate = false;
        $this->api('POST', 'orders/AG-10001/pay')->assertOk()->assertJsonPath('data.payment.client_secret', 'pi_1_secret_1');
    }

    public function test_stale_orders_are_cancelled_and_reorder(): void
    {
        $this->checkout($this->payload())->assertCreated();
        Order::query()->update(['created_at' => now()->subHours(25)]);
        $this->artisan('orders:cancel-stale')->assertSuccessful();
        $this->assertSame('cancelled', Order::first()->status);

        $this->api('POST', 'orders/AG-10001/reorder')->assertOk()->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.legacy_id', 'r1')->assertJsonPath('data.items.1.type', 'custom_ring');

        $other = User::create(['first_name' => 'O', 'last_name' => 'U', 'email' => 'o@example.com', 'password' => 'secret123']);
        Sanctum::actingAs($other);
        $this->api('GET', 'orders/AG-10001')->assertNotFound();
    }
}
