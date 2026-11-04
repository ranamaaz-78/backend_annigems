<?php

namespace App\Services\Stripe;

use App\Models\Order;
use App\Models\User;
use Stripe\StripeClient;
use Stripe\Webhook;

class StripeClientGateway implements StripeGateway
{
    private ?StripeClient $client = null;

    private function client(): StripeClient
    {
        return $this->client ??= new StripeClient((string) config('services.stripe.secret'));
    }

    public function ensureCustomer(User $user): string
    {
        if ($user->stripe_customer_id) {
            return $user->stripe_customer_id;
        }
        $customer = $this->client()->customers->create([
            'email' => $user->email,
            'name' => $user->name,
            'metadata' => ['user_id' => $user->id],
        ], ['idempotency_key' => 'customer-user-'.$user->id]);
        $user->forceFill(['stripe_customer_id' => $customer->id])->save();

        return $customer->id;
    }

    public function createPaymentIntent(Order $order, string $customerId, string $idempotencyKey): array
    {
        $pi = $this->client()->paymentIntents->create([
            'amount' => $order->total,
            'currency' => strtolower($order->currency),
            'customer' => $customerId,
            'payment_method_types' => ['card'],
            'receipt_email' => $order->email,
            'description' => 'AANI GEMAS order '.$order->order_number,
            'metadata' => ['order_id' => $order->id, 'order_number' => $order->order_number],
        ], ['idempotency_key' => $idempotencyKey]);

        return $this->pi($pi);
    }

    public function retrievePaymentIntent(string $id): array
    {
        return $this->pi($this->client()->paymentIntents->retrieve($id));
    }

    public function cancelPaymentIntent(string $id): void
    {
        $pi = $this->client()->paymentIntents->retrieve($id);
        if (! in_array($pi->status, ['succeeded', 'canceled'], true)) {
            $this->client()->paymentIntents->cancel($id);
        }
    }

    public function createEphemeralKey(string $customerId): string
    {
        $key = $this->client()->ephemeralKeys->create(
            ['customer' => $customerId],
            ['stripe_version' => config('services.stripe.ephemeral_key_version', '2024-06-20')]
        );

        return $key->secret;
    }

    public function refund(string $paymentIntentId, int $amount, array $metadata = []): array
    {
        $r = $this->client()->refunds->create(['payment_intent' => $paymentIntentId, 'amount' => $amount, 'metadata' => $metadata]);

        return ['id' => $r->id, 'status' => $r->status, 'amount' => $r->amount];
    }

    public function constructEvent(string $payload, string $signature): array
    {
        return Webhook::constructEvent($payload, $signature, (string) config('services.stripe.webhook_secret'))->toArray();
    }

    private function pi($pi): array
    {
        return ['id' => $pi->id, 'client_secret' => $pi->client_secret, 'status' => $pi->status, 'amount' => $pi->amount, 'currency' => $pi->currency];
    }
}
