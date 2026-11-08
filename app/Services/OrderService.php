<?php

namespace App\Services;

use App\Mail\NewPaidOrder;
use App\Mail\OrderCancelledMail;
use App\Mail\OrderConfirmedMail;
use App\Mail\OrderStageMail;
use App\Mail\PaymentFailedMail;
use App\Mail\RefundIssuedMail;
use App\Models\AdminUser;
use App\Models\ConfigRingStone;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\OrderStage;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/** Order lifecycle: payment results, fulfilment stages, cancellation, refunds, history and emails. */
class OrderService
{
    public function __construct(private PaymentService $payments) {}

    public function recordHistory(Order $order, string $field, ?string $from, string $to, ?string $note = null, ?AdminUser $admin = null, bool $notified = false): OrderStatusHistory
    {
        return $order->history()->create([
            'field' => $field,
            'from' => $from,
            'to' => $to,
            'note' => $note,
            'admin_user_id' => $admin?->id,
            'customer_notified' => $notified,
        ]);
    }

    // ---- payment (webhook only) ---------------------------------------------

    /** payment_intent.succeeded: paid + placed, stock, coupon usage, emails. Idempotent per order. */
    public function markPaid(Order $order, ?string $paymentIntentId = null, string $paidNote = 'Payment received'): bool
    {
        $changed = DB::transaction(function () use ($order, $paymentIntentId, $paidNote) {
            $order = Order::whereKey($order->id)->lockForUpdate()->first();
            if ($order->isPaidLike()) {
                return false;
            }
            $from = $order->status;
            $order->forceFill([
                'status' => 'paid',
                'stage' => 'placed',
                'paid_at' => now(),
                'stripe_payment_intent_id' => $paymentIntentId ?? $order->stripe_payment_intent_id,
                'cancelled_at' => null,
                'cancel_reason' => null,
            ]);

            // Decrement stock; flag the order instead of failing when it goes negative.
            foreach ($order->items()->where('kind', 'product')->whereNotNull('product_id')->get() as $item) {
                $product = Product::withTrashed()->whereKey($item->product_id)->lockForUpdate()->first();
                if ($product && $product->track_stock) {
                    $product->decrement('stock_qty', $item->qty);
                    if ($product->fresh()->stock_qty < 0) {
                        $order->stock_issue = true;
                    }
                }
            }
            $order->save();

            if ($order->coupon_code) {
                Coupon::withTrashed()->where('code', $order->coupon_code)->increment('used_count');
            }

            $note = $from === 'cancelled' ? 'Payment succeeded after the order was cancelled; please review.' : $paidNote;
            $this->recordHistory($order, 'status', $from, 'paid', $note, null, true);
            $this->recordHistory($order, 'stage', null, 'placed', null, null, true);

            return true;
        });

        if ($changed) {
            $order->refresh();
            Mail::to($order->email)->queue(new OrderConfirmedMail($order));
            if ($to = AdminNotify::address()) {
                Mail::to($to)->queue(new NewPaidOrder($order));
            }
        }

        return $changed;
    }

    /**
     * Cash on delivery (temporary, while Stripe is not set up): confirms the order like a successful
     * payment (stage placed, stock, coupon usage, emails). The history note marks it as COD.
     */
    public function confirmCashOnDelivery(Order $order): bool
    {
        return $this->markPaid($order, null, 'Cash on delivery: payment to be collected on delivery');
    }

    /** payment_intent.payment_failed: keep the order so the customer can retry. */
    public function markPaymentFailed(Order $order, ?string $reason = null): bool
    {
        $changed = DB::transaction(function () use ($order, $reason) {
            $order = Order::whereKey($order->id)->lockForUpdate()->first();
            if ($order->status !== 'pending_payment') {
                return false;
            }
            $order->forceFill(['status' => 'payment_failed'])->save();
            $this->recordHistory($order, 'status', 'pending_payment', 'payment_failed', $reason, null, true);

            return true;
        });
        if ($changed) {
            Mail::to($order->email)->queue(new PaymentFailedMail($order->refresh(), $reason));
        }

        return $changed;
    }

    /** charge.refunded: total refunded so far (minor, order currency). */
    public function applyRefund(Order $order, int $amountRefunded): bool
    {
        $result = DB::transaction(function () use ($order, $amountRefunded) {
            $order = Order::whereKey($order->id)->lockForUpdate()->first();
            if ($amountRefunded <= $order->refunded_amount) {
                return null;
            }
            $delta = $amountRefunded - $order->refunded_amount;
            $from = $order->status;
            $to = $amountRefunded >= $order->total ? 'refunded' : 'partially_refunded';
            $order->forceFill(['refunded_amount' => min($amountRefunded, $order->total), 'status' => $to])->save();
            $this->recordHistory($order, 'status', $from, $to, 'Refunded '.app(CurrencyService::class)->format($delta, $order->currency), null, true);

            return $delta;
        });
        if ($result) {
            Mail::to($order->email)->queue(new RefundIssuedMail($order->refresh(), $result));
        }

        return (bool) $result;
    }

    // ---- cancellation -----------------------------------------------------------

    /** Cancels an unpaid order (customer, staff or the stale-order job) and its PaymentIntent. */
    public function cancelUnpaid(Order $order, string $reason, ?AdminUser $admin = null, bool $notify = true): void
    {
        if (! $order->isPayable()) {
            throw ValidationException::withMessages(['order' => 'Only unpaid orders can be cancelled.']);
        }
        $this->payments->cancelIntent($order);
        $from = $order->status;
        $order->forceFill(['status' => 'cancelled', 'cancelled_at' => now(), 'cancel_reason' => $reason])->save();
        $this->recordHistory($order, 'status', $from, 'cancelled', $reason, $admin, $notify);
        if ($notify) {
            Mail::to($order->email)->queue(new OrderCancelledMail($order));
        }
    }

    // ---- fulfilment (admin) --------------------------------------------------------

    /**
     * Moves the stage one step forward (or one step back with a note).
     * `shipped` requires carrier + tracking number.
     */
    public function changeStage(Order $order, string $to, AdminUser $admin, array $data = []): void
    {
        if (! in_array($order->status, ['paid', 'partially_refunded'], true)) {
            throw ValidationException::withMessages(['stage' => 'Stages can only change on paid orders.']);
        }
        $stages = Order::STAGES;
        $cur = array_search($order->stage ?? 'placed', $stages, true);
        $next = array_search($to, $stages, true);
        if ($next === false) {
            throw ValidationException::withMessages(['stage' => 'Unknown stage.']);
        }
        $forward = $next === $cur + 1;
        $back = $next === $cur - 1;
        if (! $forward && ! $back) {
            throw ValidationException::withMessages(['stage' => 'Stages move forward one step at a time (or back one step).']);
        }
        if ($back && empty($data['note'])) {
            throw ValidationException::withMessages(['note' => 'Please add a note explaining why the stage goes back.']);
        }
        if ($to === 'shipped' && $forward && (empty($data['carrier']) || empty($data['tracking_number']))) {
            throw ValidationException::withMessages(['tracking_number' => 'Carrier and tracking number are required to mark the order as shipped.']);
        }

        $notify = $forward && ($data['notify'] ?? true);
        $from = $order->stage;
        $order->stage = $to;
        if ($to === 'shipped' && $forward) {
            $order->fill([
                'carrier' => $data['carrier'],
                'tracking_number' => $data['tracking_number'],
                'tracking_url' => $data['tracking_url'] ?? null,
                'shipped_at' => now(),
            ]);
        }
        if ($to === 'delivered') {
            $order->delivered_at = now();
        }
        if ($back && $from === 'delivered') {
            $order->delivered_at = null;
        }
        if ($back && $from === 'shipped') {
            $order->shipped_at = null;
        }
        $order->save();
        $this->recordHistory($order, 'stage', $from, $to, $data['note'] ?? null, $admin, $notify);

        if ($notify && $to !== 'placed') {
            Mail::to($order->email)->queue(new OrderStageMail($order, $to));
        }
    }

    public function updateTracking(Order $order, array $data, AdminUser $admin): void
    {
        $order->fill(collect($data)->only(['carrier', 'tracking_number', 'tracking_url'])->all())->save();
    }

    // ---- presentation helpers -------------------------------------------------------

    /** Five-step stage timeline with labels/descriptions from order_stages. */
    public function timeline(Order $order): array
    {
        $stages = OrderStage::orderBy('sort_order')->get()->keyBy('code');
        $reached = $order->history->where('field', 'stage')->groupBy('to')->map(fn ($g) => $g->last()->created_at);
        $currentIdx = $order->stage ? array_search($order->stage, Order::STAGES, true) : -1;

        return collect(Order::STAGES)->map(fn ($code, $i) => [
            'code' => $code,
            'label' => $stages[$code]->label ?? ucfirst(str_replace('_', ' ', $code)),
            'description' => $stages[$code]->description ?? null,
            'done' => $i <= $currentIdx,
            'current' => $i === $currentIdx,
            'at' => $i <= $currentIdx ? $reached->get($code)?->toIso8601String() : null,
        ])->all();
    }

    /** Cart lines for still-available items of an order (prices are re-quoted by the client). */
    public function reorderLines(Order $order): array
    {
        $lines = [];
        $skipped = [];
        foreach ($order->items as $item) {
            if ($item->kind === 'product') {
                $p = $item->product_id ? Product::with('category')->find($item->product_id) : null;
                $ok = $p && $p->isPurchasable() && $p->in_stock && (! $p->has_sizes || in_array((string) $item->size, array_map('strval', $p->sizes ?? []), true));
                $ok ? $lines[] = array_filter(['type' => 'product', 'product_id' => $p->id, 'legacy_id' => $p->legacy_id, 'qty' => $item->qty, 'size' => $p->has_sizes ? $item->size : null], fn ($v) => $v !== null)
                    : $skipped[] = $item->name;
            } else {
                $combo = ConfigRingStone::with(['ring', 'stone'])->where('ring_id', $item->config_ring_id)->where('stone_id', $item->config_stone_id)->first();
                $ok = $combo && $combo->isAvailable() && in_array((string) $item->size, array_map('strval', $combo->ring->sizes ?? []), true);
                $ok ? $lines[] = ['type' => 'custom_ring', 'ring_id' => $item->config_ring_id, 'stone_id' => $item->config_stone_id, 'size' => $item->size, 'qty' => $item->qty]
                    : $skipped[] = $item->name;
            }
        }

        return ['items' => $lines, 'unavailable' => $skipped];
    }
}
