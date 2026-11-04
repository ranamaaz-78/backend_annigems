<?php

namespace Tests\Support;

use App\Models\Order;
use App\Models\User;
use App\Services\Stripe\StripeGateway;

class FakeStripeGateway implements StripeGateway
{
    public array $intents = [];

    public array $refunds = [];

    public array $cancelled = [];

    public bool $failCreate = false;

    private int $seq = 0;

    public function ensureCustomer(User $user): string
    {
        if (! $user->stripe_customer_id) {
            $user->forceFill(['stripe_customer_id' => 'cus_'.$user->id])->save();
        }

        return $user->stripe_customer_id;
    }

    public function createPaymentIntent(Order $order, string $customerId, string $idempotencyKey): array
    {
        if ($this->failCreate) {
            throw new \RuntimeException('Stripe is down');
        }
        $id = 'pi_'.(++$this->seq);

        return $this->intents[$id] = [
            'id' => $id, 'client_secret' => $id.'_secret_'.$this->seq, 'status' => 'requires_payment_method',
            'amount' => $order->total, 'currency' => strtolower($order->currency),
            'customer' => $customerId, 'metadata' => ['order_id' => $order->id, 'order_number' => $order->order_number],
        ];
    }

    public function retrievePaymentIntent(string $id): array
    {
        return $this->intents[$id];
    }

    public function cancelPaymentIntent(string $id): void
    {
        $this->cancelled[] = $id;
        $this->intents[$id]['status'] = 'canceled';
    }

    public function createEphemeralKey(string $customerId): string
    {
        return 'ek_test_'.$customerId;
    }

    public function refund(string $paymentIntentId, int $amount, array $metadata = []): array
    {
        $this->refunds[] = compact('paymentIntentId', 'amount');

        return ['id' => 're_'.count($this->refunds), 'status' => 'succeeded', 'amount' => $amount];
    }

    public function constructEvent(string $payload, string $signature): array
    {
        if ($signature !== 'valid') {
            throw new \UnexpectedValueException('bad signature');
        }

        return json_decode($payload, true);
    }
}
