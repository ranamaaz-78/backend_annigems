<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Mail\OrderConfirmedMail;
use App\Models\Order;
use App\Services\CurrencyService;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Support\Media;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/** @group Admin: Orders */
class OrderController extends Controller
{
    public function __construct(private OrderService $orders, private CurrencyService $fx) {}

    private function query(Request $request): Builder
    {
        $q = Order::query()->withCount('items');
        foreach (['status', 'stage', 'currency', 'placed_from'] as $f) {
            if ($request->filled($f)) {
                $q->whereIn($f, (array) $request->input($f));
            }
        }
        if ($request->filled('platform')) {
            $q->where('placed_from', $request->input('platform'));
        }
        if ($request->filled('from')) {
            $q->where('created_at', '>=', $request->date('from')->startOfDay());
        }
        if ($request->filled('to')) {
            $q->where('created_at', '<=', $request->date('to')->endOfDay());
        }
        if ($request->boolean('to_craft')) {
            $q->whereIn('status', ['paid', 'partially_refunded'])->whereIn('stage', ['placed', 'crafting']);
        }
        if ($request->boolean('stock_issue')) {
            $q->where('stock_issue', true);
        }
        if ($request->filled('user_id')) {
            $q->where('user_id', $request->integer('user_id'));
        }
        if (($term = trim((string) $request->input('q'))) !== '') {
            $q->where(fn ($w) => $w->where('order_number', 'like', "%{$term}%")
                ->orWhere('email', 'like', "%{$term}%")
                ->orWhere('ship_name', 'like', "%{$term}%"));
        }
        $sort = (string) $request->input('sort', '-id');
        $col = ltrim($sort, '-');
        if (in_array($col, ['id', 'order_number', 'total_eur', 'created_at', 'status', 'stage'], true)) {
            $q->orderBy($col, str_starts_with($sort, '-') ? 'desc' : 'asc');
        }

        return $q->orderByDesc('id');
    }

    public function index(Request $request): JsonResponse
    {
        $page = $this->query($request)->paginate(min(100, max(1, $request->integer('per_page', 20))));

        return response()->json([
            'data' => collect($page->items())->map(fn (Order $o) => $this->row($o)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
        ]);
    }

    private function row(Order $o): array
    {
        return [
            'id' => $o->id,
            'order_number' => $o->order_number,
            'email' => $o->email,
            'customer_name' => $o->ship_name,
            'user_id' => $o->user_id,
            'status' => $o->status,
            'stage' => $o->stage,
            'currency' => $o->currency,
            'total' => $this->fx->money($o->total, $o->currency),
            'total_eur' => $o->total_eur,
            'placed_from' => $o->placed_from,
            'items_count' => $o->items_count,
            'stock_issue' => $o->stock_issue,
            'created_at' => $o->created_at->toIso8601String(),
            'paid_at' => $o->paid_at?->toIso8601String(),
        ];
    }

    public function export(Request $request): StreamedResponse
    {
        $q = $this->query($request);

        return response()->streamDownload(function () use ($q) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Order', 'Created', 'Status', 'Stage', 'Customer', 'Email', 'Platform', 'Currency', 'Subtotal', 'Discount', 'Shipping', 'Tax', 'Total', 'Total EUR', 'Refunded', 'Coupon', 'Shipping method', 'Country', 'Paid at']);
            $q->chunk(500, function ($orders) use ($out) {
                foreach ($orders as $o) {
                    $f = fn ($v) => number_format($v / 100, 2, '.', '');
                    fputcsv($out, [
                        $o->order_number, $o->created_at->toDateTimeString(), $o->status, $o->stage, $o->ship_name, $o->email, $o->placed_from,
                        $o->currency, $f($o->subtotal), $f($o->discount), $f($o->shipping), $f($o->tax), $f($o->total), $f($o->total_eur),
                        $f($o->refunded_amount), $o->coupon_code, $o->shipping_method_name, $o->ship_country, $o->paid_at?->toDateTimeString(),
                    ]);
                }
            });
            fclose($out);
        }, 'orders-'.now()->format('Y-m-d-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    public function show(string $number): JsonResponse
    {
        return response()->json(['data' => $this->detail($this->find($number))]);
    }

    private function detail(Order $o): array
    {
        $o->load(['items', 'history.admin:id,name', 'notes.admin:id,name', 'user' => fn ($q) => $q->withCount('orders')]);
        $m = fn ($v) => $this->fx->money((int) $v, $o->currency);
        $eur = fn ($v) => $this->fx->money((int) $v, 'EUR');
        $stripeBase = str_starts_with((string) config('services.stripe.secret'), 'sk_live') ? 'https://dashboard.stripe.com' : 'https://dashboard.stripe.com/test';

        return array_merge($o->only([
            'id', 'order_number', 'email', 'placed_from', 'status', 'stage', 'currency', 'exchange_rate', 'coupon_code', 'coupon_snapshot',
            'shipping_method_code', 'shipping_method_name', 'shipping_delivery_time', 'ship_name', 'ship_phone', 'ship_line1', 'ship_city',
            'ship_state', 'ship_zip', 'ship_country', 'ship_country_code', 'stripe_payment_intent_id', 'stripe_customer_id', 'carrier',
            'tracking_number', 'tracking_url', 'cancel_reason', 'customer_note', 'stock_issue', 'tax_rate',
        ]), [
            'created_at' => $o->created_at->toIso8601String(),
            'paid_at' => $o->paid_at?->toIso8601String(),
            'shipped_at' => $o->shipped_at?->toIso8601String(),
            'delivered_at' => $o->delivered_at?->toIso8601String(),
            'cancelled_at' => $o->cancelled_at?->toIso8601String(),
            'totals' => [
                'subtotal' => $m($o->subtotal), 'discount' => $m($o->discount), 'shipping' => $m($o->shipping),
                'tax' => $m($o->tax), 'total' => $m($o->total), 'refunded' => $m($o->refunded_amount),
                'refundable' => $m(max(0, $o->total - $o->refunded_amount)), 'total_eur' => $eur($o->total_eur),
            ],
            'stripe_url' => $o->stripe_payment_intent_id ? $stripeBase.'/payments/'.$o->stripe_payment_intent_id : null,
            'customer' => $o->user ? [
                'id' => $o->user->id, 'name' => $o->user->name, 'email' => $o->user->email, 'phone' => $o->user->phone,
                'orders_count' => $o->user->orders_count, 'deleted' => $o->user->trashed(),
            ] : null,
            'items' => $o->items->map(fn ($i) => [
                'id' => $i->id, 'kind' => $i->kind, 'product_id' => $i->product_id, 'name' => $i->name, 'subtitle' => $i->subtitle,
                'image_url' => Media::url($i->image), 'size' => $i->size, 'qty' => $i->qty,
                'unit_price' => $m($i->unit_price), 'line_total' => $m($i->line_total), 'unit_price_eur' => $eur($i->unit_price_eur),
                'snapshot' => $i->snapshot,
                'breakdown' => $i->kind === 'custom_ring' ? [
                    'gold_value_eur' => $eur($i->snapshot['gold_value_eur'] ?? 0),
                    'craft_fee_eur' => $eur($i->snapshot['craft_fee_eur'] ?? 0),
                    'ring_charge_eur' => $eur($i->snapshot['ring_charge_eur'] ?? 0),
                    'stone_price_eur' => $eur($i->snapshot['stone_price_eur'] ?? 0),
                    'gold_rate_per_oz_eur' => $eur($i->snapshot['gold_rate_per_oz_eur'] ?? 0),
                ] : null,
            ]),
            'history' => $o->history->map(fn ($h) => [
                'id' => $h->id, 'field' => $h->field, 'from' => $h->from, 'to' => $h->to, 'note' => $h->note,
                'admin' => $h->admin?->name, 'customer_notified' => $h->customer_notified, 'at' => $h->created_at->toIso8601String(),
            ]),
            'notes' => $o->notes->map(fn ($n) => ['id' => $n->id, 'body' => $n->body, 'admin' => $n->admin?->name, 'at' => $n->created_at->toIso8601String()]),
            'timeline' => $this->orders->timeline($o),
            'next_stage' => $o->stage ? (Order::STAGES[array_search($o->stage, Order::STAGES, true) + 1] ?? null) : null,
            'previous_stage' => $o->stage ? (Order::STAGES[array_search($o->stage, Order::STAGES, true) - 1] ?? null) : null,
        ]);
    }

    /** Change stage (+ tracking when shipping). */
    public function stage(Request $request, string $number): JsonResponse
    {
        $order = $this->find($number);
        $data = $request->validate([
            'stage' => ['required', Rule::in(Order::STAGES)],
            'carrier' => ['nullable', 'string', 'max:80'],
            'tracking_number' => ['nullable', 'string', 'max:120'],
            'tracking_url' => ['nullable', 'url', 'max:255'],
            'note' => ['nullable', 'string', 'max:1000'],
            'notify' => ['boolean'],
        ]);
        $this->orders->changeStage($order, $data['stage'], $request->user('admin'), $data);

        return response()->json(['data' => $this->detail($order->refresh()), 'message' => 'Stage updated.']);
    }

    public function tracking(Request $request, string $number): JsonResponse
    {
        $order = $this->find($number);
        $data = $request->validate([
            'carrier' => ['nullable', 'string', 'max:80'],
            'tracking_number' => ['nullable', 'string', 'max:120'],
            'tracking_url' => ['nullable', 'url', 'max:255'],
        ]);
        $this->orders->updateTracking($order, $data, $request->user('admin'));

        return response()->json(['data' => $this->detail($order->refresh()), 'message' => 'Tracking saved.']);
    }

    public function cancel(Request $request, string $number): JsonResponse
    {
        $order = $this->find($number);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:255'], 'notify' => ['boolean']]);
        $this->orders->cancelUnpaid($order, ($data['reason'] ?? null) ?: 'Cancelled by staff', $request->user('admin'), $data['notify'] ?? true);

        return response()->json(['data' => $this->detail($order->refresh()), 'message' => 'Order cancelled.']);
    }

    /** Full or partial refund through Stripe (amount in order-currency minor units). The webhook updates the status. */
    public function refund(Request $request, string $number, PaymentService $payments): JsonResponse
    {
        $order = $this->find($number);
        if (! in_array($order->status, ['paid', 'partially_refunded'], true) || ! $order->stripe_payment_intent_id) {
            throw ValidationException::withMessages(['amount' => 'Only paid orders can be refunded.']);
        }
        $max = $order->total - $order->refunded_amount;
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:'.$max],
            'reason' => ['nullable', 'string', 'max:255'],
        ], ['amount.max' => 'You can refund at most '.$this->fx->format($max, $order->currency).'.']);

        try {
            $refund = $payments->refund($order, $data['amount'], $request->user('admin')->id);
        } catch (Throwable $e) {
            report($e);
            throw ValidationException::withMessages(['amount' => 'Stripe refused the refund: '.$e->getMessage()]);
        }
        $order->notes()->create([
            'admin_user_id' => $request->user('admin')->id,
            'body' => 'Refund of '.$this->fx->format($data['amount'], $order->currency).' requested ('.$refund['id'].', '.$refund['status'].')'.(! empty($data['reason']) ? ': '.$data['reason'] : ''),
        ]);
        activity('orders')->causedBy($request->user('admin'))->performedOn($order)->withProperties(['amount' => $data['amount'], 'refund' => $refund])->log('Refund issued');

        return response()->json(['data' => $this->detail($order->refresh()), 'message' => 'Refund sent to Stripe. The order updates when Stripe confirms it.']);
    }

    public function resendConfirmation(string $number): JsonResponse
    {
        $order = $this->find($number);
        if (! $order->isPaidLike()) {
            throw ValidationException::withMessages(['order' => 'The confirmation email is only sent for paid orders.']);
        }
        Mail::to($order->email)->queue(new OrderConfirmedMail($order));

        return response()->json(['message' => 'Confirmation email queued.']);
    }

    public function addNote(Request $request, string $number): JsonResponse
    {
        $order = $this->find($number);
        $data = $request->validate(['body' => ['required', 'string', 'max:5000']]);
        $order->notes()->create(['admin_user_id' => $request->user('admin')->id, 'body' => $data['body']]);

        return response()->json(['data' => $this->detail($order->refresh()), 'message' => 'Note added.']);
    }

    /** Printable invoice or packing slip (HTML print view). */
    public function document(string $number, string $type): Response
    {
        abort_unless(in_array($type, ['invoice', 'packing-slip'], true), 404);
        $order = $this->find($number)->load('items');

        return response()->view('admin.order-'.$type, ['order' => $order, 'fx' => $this->fx]);
    }

    private function find(string $number): Order
    {
        return Order::where('order_number', strtoupper($number))->firstOrFail();
    }
}
