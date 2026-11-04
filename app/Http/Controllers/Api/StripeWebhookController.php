<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\StripeEvent;
use App\Services\OrderService;
use App\Services\Stripe\StripeGateway;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * @group Webhooks
 *
 * Stripe webhook. Verifies the `Stripe-Signature` header with STRIPE_WEBHOOK_SECRET.
 * Idempotent: every event id is processed once. Only this endpoint marks orders paid.
 *
 * @unauthenticated
 */
class StripeWebhookController extends Controller
{
    public function __invoke(Request $request, StripeGateway $stripe, OrderService $orders): JsonResponse
    {
        try {
            $event = $stripe->constructEvent($request->getContent(), (string) $request->header('Stripe-Signature'));
        } catch (Throwable $e) {
            Log::warning('Stripe webhook rejected: '.$e->getMessage());

            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        try {
            $record = StripeEvent::firstOrCreate(['event_id' => $event['id']], ['type' => $event['type'], 'payload' => $event]);
        } catch (UniqueConstraintViolationException) {
            $record = StripeEvent::where('event_id', $event['id'])->first();
        }
        if ($record->processed_at) {
            return response()->json(['received' => true, 'duplicate' => true]);
        }

        $object = Arr::get($event, 'data.object', []);
        switch ($event['type']) {
            case 'payment_intent.succeeded':
                if ($order = $this->orderFor($object)) {
                    $orders->markPaid($order, $object['id'] ?? null);
                }
                break;
            case 'payment_intent.payment_failed':
                if ($order = $this->orderFor($object)) {
                    $orders->markPaymentFailed($order, Arr::get($object, 'last_payment_error.message'));
                }
                break;
            case 'charge.refunded':
                if ($order = $this->orderFor($object, $object['payment_intent'] ?? null)) {
                    $orders->applyRefund($order, (int) ($object['amount_refunded'] ?? 0));
                }
                break;
        }

        $record->forceFill(['processed_at' => now()])->save();

        return response()->json(['received' => true]);
    }

    private function orderFor(array $object, ?string $paymentIntentId = null): ?Order
    {
        $id = Arr::get($object, 'metadata.order_id');
        $order = $id ? Order::find($id) : null;
        $pi = $paymentIntentId ?? (($object['object'] ?? null) === 'payment_intent' ? ($object['id'] ?? null) : null);
        $order ??= $pi ? Order::where('stripe_payment_intent_id', $pi)->first() : null;
        if (! $order) {
            Log::warning('Stripe webhook: no order for object '.($object['id'] ?? '?'));
        }

        return $order;
    }
}
