<?php

namespace App\Services\Stripe;

use App\Models\Order;
use App\Models\User;
use Stripe\Exception\SignatureVerificationException;

/** Thin Stripe boundary so checkout/webhook logic can be tested without the network. */
interface StripeGateway
{
    /** Returns the Stripe Customer id for this user (created on first use). */
    public function ensureCustomer(User $user): string;

    /** @return array{id: string, client_secret: string, status: string, amount: int, currency: string} */
    public function createPaymentIntent(Order $order, string $customerId, string $idempotencyKey): array;

    /** @return array{id: string, client_secret: string, status: string, amount: int, currency: string} */
    public function retrievePaymentIntent(string $id): array;

    public function cancelPaymentIntent(string $id): void;

    /** Ephemeral key secret for the mobile PaymentSheet. */
    public function createEphemeralKey(string $customerId): string;

    /** @return array{id: string, status: string, amount: int} */
    public function refund(string $paymentIntentId, int $amount, array $metadata = []): array;

    /**
     * Verifies the signature and returns the event as an array.
     *
     * @throws \UnexpectedValueException|SignatureVerificationException
     */
    public function constructEvent(string $payload, string $signature): array;
}
