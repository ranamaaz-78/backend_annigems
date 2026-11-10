<?php

namespace Tests\Feature\B2b;

use App\Mail\B2bOrderReceivedMail;
use App\Mail\NewB2bOrder;
use App\Mail\OrderCancelledMail;
use App\Mail\OrderConfirmedMail;
use App\Models\AdminUser;
use App\Models\B2bTier;
use App\Models\ConfigRing;
use App\Models\ConfigStone;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\Stripe\StripeGateway;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Feature\Admin\AdminTestCase;
use Tests\Support\FakeStripeGateway;

class B2bFlowTest extends AdminTestCase
{
    private AdminUser $boss;

    private FakeStripeGateway $stripe;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['services.admin_notify' => 'ops@aanigems.com', 'services.cod.enabled' => false]);
        $this->stripe = new FakeStripeGateway;
        $this->app->instance(StripeGateway::class, $this->stripe);
        $this->boss = $this->actingAsStaff();
    }

    private function actAsAdmin(AdminUser $u): void
    {
        $u->forceFill(['two_factor_secret' => 'JBSWY3DPEHPK3PXP', 'two_factor_confirmed_at' => now()])->save();
        $this->actingAs($u, 'admin')->withSession(['admin_2fa_passed' => true, 'admin_last_activity' => time()]);
    }

    private function createRep(string $email, float $rate = 10): AdminUser
    {
        $this->actAsAdmin($this->boss);
        $res = $this->admin('POST', 'b2b/sales-reps', [
            'name' => 'Rep '.$email, 'email' => $email, 'password' => 'Sales@123456', 'phone' => '+1 555', 'commission_rate' => $rate,
        ])->assertCreated();
        $this->assertEquals($rate, $res->json('data.commission_rate'));

        return AdminUser::findOrFail($res->json('data.id'));
    }

    private function gold(): B2bTier
    {
        return B2bTier::where('name', 'Gold')->firstOrFail();
    }

    private function onboard(AdminUser $rep, string $email = 'shop@biz.test'): User
    {
        $this->actAsAdmin($rep);
        $id = $this->admin('POST', 'b2b/businesses', [
            'company_name' => 'Rao Jewellers', 'first_name' => 'Rahul', 'last_name' => 'Rao', 'email' => $email,
            'password' => 'Business@1', 'phone' => '+91 98200', 'tier_id' => $this->gold()->id, 'sales_rep_id' => 999,
            'address' => ['line1' => '14 Zaveri Bazaar', 'city' => 'Mumbai', 'zip' => '400002', 'country_code' => 'IN'],
        ])->assertCreated()->assertJsonPath('data.sales_rep.id', $rep->id)->assertJsonPath('data.tier.name', 'Gold')->json('data.id');

        return User::findOrFail($id);
    }

    private function checkout(User $business, string $key, array $over = [])
    {
        Sanctum::actingAs($business);
        $ring = ConfigRing::where('slug', 'aurora-solitaire')->first();
        $ruby = ConfigStone::where('slug', 'ruby')->first();

        return $this->api('POST', 'checkout', $over + [
            'items' => [
                ['type' => 'product', 'product_id' => Product::findBySlugOrLegacy('r1')->id, 'size' => '7', 'qty' => 2],
                ['type' => 'custom_ring', 'ring_id' => $ring->id, 'stone_id' => $ruby->id, 'size' => '6.5', 'qty' => 1],
            ],
            'address_id' => $business->addresses()->first()->id,
            'shipping_method' => 'standard',
        ], ['Idempotency-Key' => $key]);
    }

    public function test_full_b2b_flow_tier_prices_approval_commission_and_payout(): void
    {
        $product = Product::findBySlugOrLegacy('r1');
        $rep = $this->createRep('rep1@aanigems.test', 10);

        // Super admin sets Gold: 40% on the r1 category, 25% on Design Your Ring.
        $this->actAsAdmin($this->boss);
        $this->admin('PUT', 'b2b/tiers/'.$this->gold()->id.'/discounts', ['discounts' => [
            ['category_id' => $product->category_id, 'percent' => 40],
            ['category_id' => null, 'percent' => 25],
        ]])->assertOk();

        // Sales person onboards a business: assigned to them (their sales_rep_id input is ignored), active at once.
        $business = $this->onboard($rep);
        $this->assertTrue($business->isBusiness());

        // The business sees its tier price everywhere; retail customers do not.
        $this->api('GET', 'products/r1')->assertJsonPath('data.price.amount', $product->price)->assertJsonPath('data.retail_price', null);
        Sanctum::actingAs($business);
        $b2bUnit = (int) round($product->price * 0.6);
        $this->api('GET', 'products/r1')->assertJsonPath('data.price.amount', $b2bUnit)
            ->assertJsonPath('data.retail_price.amount', $product->price);
        $this->api('GET', 'me')->assertJsonPath('data.account_type', 'business')
            ->assertJsonPath('data.business.company_name', 'Rao Jewellers')->assertJsonPath('data.business.tier', 'Gold');
        $this->api('POST', 'cart/quote', ['items' => [['type' => 'product', 'product_id' => $product->id, 'size' => '7', 'qty' => 1]], 'coupon_code' => 'AANI10'])
            ->assertOk()->assertJsonPath('data.coupon.valid', false)->assertJsonPath('data.lines.0.unit_price.amount', $b2bUnit)
            ->assertJsonPath('data.lines.0.retail_unit_price.amount', $product->price);

        // Checkout: cash on delivery even though retail COD is off; waits for approval; no Stripe; stock untouched.
        $stockBefore = $product->fresh()->stock_qty;
        $res = $this->checkout($business, 'b2b-1')->assertCreated()
            ->assertJsonPath('data.order.status', 'awaiting_approval')->assertJsonPath('data.order.payment_method', 'cod')
            ->assertJsonPath('data.payment', null);
        $number = $res->json('data.order.number');
        $order = Order::where('order_number', $number)->firstOrFail();
        $ringUnit = $order->items->firstWhere('kind', 'custom_ring')->unit_price;
        $this->assertSame($b2bUnit, $order->items->firstWhere('kind', 'product')->unit_price);
        $this->assertEquals(25, $order->items->firstWhere('kind', 'custom_ring')->snapshot['b2b_percent']);
        $this->assertSame('business', $order->account_type);
        $this->assertSame($rep->id, $order->sales_rep_id);
        $this->assertSame('Gold', $order->b2b_tier_name);
        $this->assertSame(0, $order->discount);
        $this->assertSame(2 * $b2bUnit + $ringUnit, $order->commission_base);
        $this->assertSame((int) round($order->commission_base * 0.10), $order->commission_amount);
        $this->assertSame('pending', $order->commissionState());
        $this->assertSame([], $this->stripe->intents);
        $this->assertSame($stockBefore, $product->fresh()->stock_qty);
        Mail::assertQueued(B2bOrderReceivedMail::class, 1);
        Mail::assertQueued(NewB2bOrder::class, 1);

        // Retail lists stay retail-only.
        $this->actAsAdmin($this->boss);
        $this->admin('GET', 'orders')->assertJsonCount(0, 'data');
        $this->admin('GET', 'customers?q=shop@biz.test')->assertJsonCount(0, 'data');

        // The sales person sees the order but cannot approve it or move stages.
        $this->actAsAdmin($rep);
        $this->admin('GET', 'b2b/orders')->assertJsonCount(1, 'data')->assertJsonPath('data.0.commission.state', 'pending');
        $this->admin('POST', "b2b/orders/{$number}/approve")->assertForbidden();
        $this->admin('POST', "orders/{$number}/stage", ['stage' => 'crafting'])->assertForbidden();

        // Staff approves: confirmed + placed, stock reserved, confirmation email.
        $this->actAsAdmin($this->boss);
        $this->admin('POST', "b2b/orders/{$number}/approve")->assertOk()->assertJsonPath('data.status', 'confirmed')->assertJsonPath('data.stage', 'placed');
        $this->admin('POST', "b2b/orders/{$number}/approve")->assertStatus(422);
        $this->assertSame($stockBefore - 2, $product->fresh()->stock_qty);
        Mail::assertQueued(OrderConfirmedMail::class, 1);

        // Fulfilment through the regular stage endpoint; delivered = commission earned.
        foreach (['crafting', 'quality_check'] as $stage) {
            $this->admin('POST', "orders/{$number}/stage", ['stage' => $stage])->assertOk();
        }
        $this->admin('POST', "orders/{$number}/stage", ['stage' => 'shipped', 'carrier' => 'DHL', 'tracking_number' => 'T1'])->assertOk();
        $this->admin('POST', "b2b/orders/{$number}/cancel", ['reason' => 'x'])->assertStatus(422); // shipped
        $this->admin('POST', "orders/{$number}/stage", ['stage' => 'delivered'])->assertOk();
        $commission = $order->fresh()->commission_amount_eur;
        $this->assertSame('earned', $order->fresh()->commissionState());

        // Payout of part of it; balance = earned − paid.
        $this->admin('POST', 'b2b/payouts', ['sales_rep_id' => $rep->id, 'amount' => 1000, 'paid_at' => now()->toDateString(), 'method' => 'Bank'])->assertCreated();
        $this->admin('GET', 'b2b/commissions?group=week')->assertOk()
            ->assertJsonPath('data.summary.earned.amount', $commission)
            ->assertJsonPath('data.summary.paid.amount', 1000)
            ->assertJsonPath('data.summary.balance.amount', $commission - 1000)
            ->assertJsonPath('data.by_rep.0.sales_rep_id', $rep->id)
            ->assertJsonPath('data.period.by_business.0.company_name', 'Rao Jewellers');
        $this->admin('GET', 'b2b/dashboard')->assertOk()->assertJsonPath('data.kpis.businesses', 1)->assertJsonPath('data.commission.balance.amount', $commission - 1000);

        // The sales person sees the same numbers for themselves, and the business sees its order.
        $this->actAsAdmin($rep);
        $this->admin('GET', 'b2b/commissions')->assertJsonPath('data.scoped', true)->assertJsonPath('data.summary.balance.amount', $commission - 1000);
        $this->admin('POST', 'b2b/payouts', ['sales_rep_id' => $rep->id, 'amount' => 1, 'paid_at' => now()->toDateString()])->assertForbidden();
        Sanctum::actingAs($business);
        $this->api('GET', "orders/{$number}")->assertJsonPath('data.status', 'confirmed')->assertJsonPath('data.tier', 'Gold');
    }

    public function test_reject_and_cancel_void_commission_and_restore_stock(): void
    {
        $rep = $this->createRep('rep1@aanigems.test', 5);
        $business = $this->onboard($rep);
        $product = Product::findBySlugOrLegacy('r1');
        $stock = $product->stock_qty;

        $first = $this->checkout($business, 'k-1')->assertCreated()->json('data.order.number');
        $this->actAsAdmin($this->boss);
        $this->admin('POST', "b2b/orders/{$first}/reject", [])->assertStatus(422)->assertJsonValidationErrors('reason');
        $this->admin('POST', "b2b/orders/{$first}/reject", ['reason' => 'Out of season'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertSame('void', Order::where('order_number', $first)->first()->commissionState());
        $this->assertSame($stock, $product->fresh()->stock_qty);
        Mail::assertQueued(OrderCancelledMail::class, 1);

        $second = $this->checkout($business, 'k-2')->assertCreated()->json('data.order.number');
        $this->actAsAdmin($this->boss);
        $this->admin('POST', "b2b/orders/{$second}/approve")->assertOk();
        $this->assertSame($stock - 2, $product->fresh()->stock_qty);
        $this->admin('POST', "b2b/orders/{$second}/cancel", ['reason' => 'Customer request'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertSame($stock, $product->fresh()->stock_qty);

        $this->admin('GET', 'b2b/commissions')->assertJsonPath('data.summary.pending.amount', 0)->assertJsonPath('data.summary.earned.amount', 0);
    }

    public function test_sales_person_scope_and_permissions(): void
    {
        $rep1 = $this->createRep('rep1@aanigems.test');
        $rep2 = $this->createRep('rep2@aanigems.test');
        $business = $this->onboard($rep1);
        $number = $this->checkout($business, 'k-1')->assertCreated()->json('data.order.number');

        $this->actAsAdmin($rep2);
        $this->admin('GET', 'b2b/businesses')->assertOk()->assertJsonCount(0, 'data');
        $this->admin('GET', 'b2b/businesses/'.$business->id)->assertNotFound();
        $this->admin('PUT', 'b2b/businesses/'.$business->id, ['company_name' => 'X'])->assertNotFound();
        $this->admin('GET', 'b2b/orders')->assertJsonCount(0, 'data');
        $this->admin('GET', "b2b/orders/{$number}")->assertNotFound();
        $this->admin('GET', 'b2b/dashboard')->assertOk()->assertJsonPath('data.scoped', true)->assertJsonPath('data.kpis.businesses', 0);
        // Retail admin, sales persons and tiers management are off limits.
        $this->admin('GET', 'orders')->assertForbidden();
        $this->admin('GET', 'customers')->assertForbidden();
        $this->admin('GET', 'b2b/sales-reps')->assertForbidden();
        $this->admin('PUT', 'b2b/tiers/'.$this->gold()->id.'/discounts', ['discounts' => []])->assertForbidden();
        $this->admin('GET', 'b2b/tiers')->assertOk();

        // Rep 1 can change the tier but not move the business to another sales person.
        $this->actAsAdmin($rep1);
        $silver = B2bTier::where('name', 'Silver')->first();
        $this->admin('PUT', 'b2b/businesses/'.$business->id, [
            'company_name' => 'Rao Jewellers', 'first_name' => 'Rahul', 'email' => 'shop@biz.test', 'tier_id' => $silver->id, 'sales_rep_id' => $rep2->id,
        ])->assertOk()->assertJsonPath('data.tier.name', 'Silver')->assertJsonPath('data.sales_rep.id', $rep1->id);

        // Staff can reassign; new orders follow the new sales person, old ones keep theirs.
        $this->actAsAdmin($this->boss);
        $this->admin('PUT', 'b2b/businesses/'.$business->id, [
            'company_name' => 'Rao Jewellers', 'first_name' => 'Rahul', 'email' => 'shop@biz.test', 'tier_id' => $silver->id, 'sales_rep_id' => $rep2->id,
        ])->assertOk()->assertJsonPath('data.sales_rep.id', $rep2->id);
        $this->assertSame($rep1->id, Order::where('order_number', $number)->value('sales_rep_id'));

        // Commission % changes only affect new orders.
        $this->admin('PUT', 'b2b/sales-reps/'.$rep2->id, ['name' => 'Rep 2', 'email' => 'rep2@aanigems.test', 'commission_rate' => 12.5])->assertOk();
        $next = $this->checkout($business, 'k-2')->assertCreated()->json('data.order.number');
        $this->assertSame(12.5, Order::where('order_number', $next)->value('commission_rate') + 0.0);
        $this->assertSame(10.0, Order::where('order_number', $number)->value('commission_rate') + 0.0);

        // Deactivated business cannot use its token.
        $this->admin('PUT', 'b2b/businesses/'.$business->id, [
            'company_name' => 'Rao Jewellers', 'first_name' => 'Rahul', 'email' => 'shop@biz.test', 'tier_id' => $silver->id, 'sales_rep_id' => $rep2->id, 'is_active' => false,
        ])->assertOk()->assertJsonPath('data.is_active', false);
    }
}
