<?php

namespace App\Services;

use App\Models\Order;
use App\Services\Stripe\StripeGateway;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

/** Stripe PaymentIntents for orders (card only, full payment upfront). */
class PaymentService
{
    private const REUSABLE = ['requires_payment_method', 'requires_confirmation', 'requires_action'];

    public function __construct(private StripeGateway $stripe) {}

    /**
     * Creates (or reuses) the PaymentIntent for a payable order and returns the
     * platform-specific payload: web → client_secret + publishable_key;
     * mobile → also customer_id + ephemeral_key (PaymentSheet).
     */
    public function paymentPayload(Order $order, string $platform): array
    {
        try {
            $customerId = $order->stripe_customer_id ?: $this->stripe->ensureCustomer($order->user);
            $pi = null;

            if ($order->stripe_payment_intent_id) {
                $existing = $this->stripe->retrievePaymentIntent($order->stripe_payment_intent_id);
                if (in_array($existing['status'], self::REUSABLE, true) && $existing['amount'] === $order->total
                    && strtoupper($existing['currency']) === $order->currency) {
                    $pi = $existing;
                }
            }

            if (! $pi) {
                $attempt = $order->history()->where('field', 'status')->where('to', 'payment_failed')->count();
                $pi = $this->stripe->createPaymentIntent($order, $customerId, "order-{$order->id}-pi-{$attempt}-".($order->stripe_payment_intent_id ? 'r' : 'n'));
                $order->forceFill(['stripe_payment_intent_id' => $pi['id'], 'stripe_customer_id' => $customerId])->save();
            }

            $payload = [
                'provider' => 'stripe',
                'payment_intent_id' => $pi['id'],
                'client_secret' => $pi['client_secret'],
                'publishable_key' => config('services.stripe.key'),
            ];
            if ($platform === 'mobile') {
                $payload['customer_id'] = $customerId;
                $payload['ephemeral_key'] = $this->stripe->createEphemeralKey($customerId);
            }

            return $payload;
        } catch (HttpException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Stripe payment setup failed for order '.$order->order_number.': '.$e->getMessage());
            throw new HttpException(502, 'We could not start the payment. Please try again in a moment.', $e);
        }
    }

    public function cancelIntent(Order $order): void
    {
        if (! $order->stripe_payment_intent_id) {
            return;
        }
        try {
            $this->stripe->cancelPaymentIntent($order->stripe_payment_intent_id);
        } catch (Throwable $e) {
            Log::warning('Could not cancel PaymentIntent '.$order->stripe_payment_intent_id.': '.$e->getMessage());
        }
    }

    /** Issues a refund through Stripe; the charge.refunded webhook updates the order. */
    public function refund(Order $order, int $amount, ?int $adminId = null): array
    {
        return $this->stripe->refund($order->stripe_payment_intent_id, $amount, [
            'order_id' => $order->id, 'order_number' => $order->order_number, 'admin_user_id' => $adminId,
        ]);
    }
}
