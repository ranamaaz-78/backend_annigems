<?php

namespace Tests\Feature\Orders;

use App\Mail;
use App\Models\ConfigRing;
use App\Models\ConfigStone;
use App\Models\ContactMessage;
use App\Models\GoldRate;
use App\Models\Order;
use App\Models\User;
use App\Services\Stripe\StripeGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\FakeStripeGateway;
use Tests\TestCase;

class EmailRenderTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_email_renders(): void
    {
        $this->seedStore();
        $this->app->instance(StripeGateway::class, new FakeStripeGateway);
        $user = User::where('email', 'demo@aanigems.com')->first();
        Sanctum::actingAs($user);
        $ring = ConfigRing::first();
        $stone = ConfigStone::first();
        $this->api('POST', 'checkout', [
            'items' => [['type' => 'custom_ring', 'ring_id' => $ring->id, 'stone_id' => $stone->id, 'size' => '7', 'qty' => 1], ['type' => 'product', 'product_id' => 7, 'qty' => 1]],
            'address_id' => $user->addresses()->first()->id, 'shipping_method' => 'standard', 'coupon_code' => 'AANI10',
        ], ['Idempotency-Key' => 'r'])->assertCreated();
        $order = Order::with('items')->first();
        $order->forceFill(['carrier' => 'DHL', 'tracking_number' => '123', 'tracking_url' => 'https://dhl.example/123', 'cancel_reason' => 'Test'])->save();

        $mails = [
            new Mail\WelcomeMail($user),
            new Mail\PasswordResetCodeMail($user, '123456'),
            new Mail\PasswordChangedMail($user),
            new Mail\OrderConfirmedMail($order),
            new Mail\PaymentFailedMail($order, 'Card declined'),
            new Mail\OrderCancelledMail($order),
            new Mail\RefundIssuedMail($order, 1000),
            new Mail\NewPaidOrder($order),
            new Mail\NewContactMessage(ContactMessage::create(['name' => 'A', 'email' => 'a@b.co', 'message' => 'Hi'])),
            new Mail\GoldRateApiFailing(4, 'HTTP 500', GoldRate::first()),
        ];
        foreach (['crafting', 'quality_check', 'shipped', 'delivered'] as $stage) {
            $mails[] = new Mail\OrderStageMail($order, $stage);
        }

        foreach ($mails as $mail) {
            $html = $mail->render();
            $this->assertStringContainsString('AANI GEMAS', $html, $mail::class);
        }
        $this->assertStringContainsString('/account/orders/'.$order->order_number, (new Mail\OrderConfirmedMail($order))->render());
        $this->assertStringContainsString('Gold €', (new Mail\OrderConfirmedMail($order))->render());
        $this->assertStringContainsString('DHL', (new Mail\OrderStageMail($order, 'shipped'))->render());
    }
}
