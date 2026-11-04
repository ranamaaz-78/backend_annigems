<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CartItemsRules;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\CheckoutService;
use App\Services\OrderService;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

/**
 * @group Checkout & orders
 *
 * @authenticated
 */
class OrderController extends Controller
{
    public function __construct(private OrderService $orders, private PaymentService $payments) {}

    /**
     * Checkout
     *
     * Requires an `Idempotency-Key` header (e.g. a UUID per checkout attempt; repeating the same request
     * with the same key returns the same order). The server re-quotes the cart, validates stock, sizes and
     * combos, creates a `pending_payment` order with snapshots and a Stripe PaymentIntent in the order currency.
     * Web returns `payment: {client_secret, publishable_key}`; mobile also returns `customer_id` and
     * `ephemeral_key` for PaymentSheet. Then confirm with Stripe and poll `GET /orders/{number}`.
     *
     * @header Idempotency-Key 6f1c2b8e-3d4a-4c6f-9a1b-2e3f4a5b6c7d
     *
     * @bodyParam items object[] required Cart lines (same shape as cart/quote).
     * @bodyParam items[].type string required Example: product
     * @bodyParam items[].product_id integer Example: 7
     * @bodyParam items[].qty integer required Example: 1
     * @bodyParam address_id integer Saved address id (or send `address`). Example: 1
     * @bodyParam address object Inline address: label, name, phone, line1, city, state, zip, country_code.
     * @bodyParam save_address boolean Save the inline address to the account. Example: false
     * @bodyParam shipping_method string required Example: standard
     * @bodyParam coupon_code string Example: AANI10
     * @bodyParam customer_note string Example: Gift wrap please
     */
    public function checkout(Request $request, CheckoutService $checkout): JsonResponse
    {
        $key = trim((string) $request->header('Idempotency-Key'));
        if ($key === '' || strlen($key) > 120) {
            throw ValidationException::withMessages(['idempotency_key' => 'The Idempotency-Key header is required.']);
        }

        $data = $request->validate(CartItemsRules::rules() + [
            'address_id' => ['nullable', 'integer', 'required_without:address'],
            'address' => ['nullable', 'array', 'required_without:address_id'],
            'save_address' => ['sometimes', 'boolean'],
            'shipping_method' => ['required', 'string', 'max:40'],
            'coupon_code' => ['nullable', 'string', 'max:40'],
            'customer_note' => ['nullable', 'string', 'max:1000'],
        ] + ($request->filled('address_id') ? [] : AddressController::rules('address.')),
            CartItemsRules::messages() + AddressController::messages('address.') + [
                'address_id.required_without' => 'Please choose or enter a shipping address.',
                'address.required_without' => 'Please choose or enter a shipping address.',
                'shipping_method.required' => 'Please choose a shipping method.',
            ]);

        $platform = $request->attributes->get('platform', 'web');
        ['order' => $order, 'replayed' => $replayed] = $checkout->placeOrder($request->user(), $data, $platform, $key);

        $payment = $order->isPayable() ? $this->payments->paymentPayload($order, $platform) : null;

        return response()->json([
            'data' => [
                'order' => (new OrderResource($order->load(['items', 'history'])))->full(),
                'payment' => $payment,
            ],
        ], $replayed ? 200 : 201);
    }

    /** My orders (newest first) */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = $request->user()->orders()->with('items')->withCount('items')->latest('id')
            ->paginate(min(50, $request->integer('per_page', 10) ?: 10));

        return OrderResource::collection($orders);
    }

    /**
     * Order detail
     *
     * Full order: items, totals, status, stage, timeline (stage labels and descriptions), tracking.
     *
     * @urlParam number string required Example: AG-10001
     */
    public function show(Request $request, string $number): JsonResponse
    {
        return response()->json(['data' => (new OrderResource($this->find($request, $number)))->full()]);
    }

    /**
     * Retry payment
     *
     * For `pending_payment` / `payment_failed` orders. Re-validates stock; prices stay as snapshotted.
     *
     * @urlParam number string required Example: AG-10001
     */
    public function pay(Request $request, string $number): JsonResponse
    {
        $order = $this->find($request, $number);
        if (! $order->isPayable()) {
            throw ValidationException::withMessages(['order' => 'This order cannot be paid.']);
        }
        foreach ($order->items->where('kind', 'product') as $item) {
            $p = $item->product;
            if (! $p || ! $p->isPurchasable() || ($p->track_stock && $p->stock_qty < $item->qty)) {
                throw ValidationException::withMessages(['order' => "{$item->name} is no longer available in the quantity ordered."]);
            }
        }
        foreach ($order->items->where('kind', 'custom_ring') as $item) {
            $ring = $item->ring;
            $stone = $item->stone;
            if (! $ring || ! $stone || ! $ring->is_active || ! $stone->is_active) {
                throw ValidationException::withMessages(['order' => "{$item->name} is no longer available."]);
            }
        }

        $payment = $this->payments->paymentPayload($order, $request->attributes->get('platform', 'web'));

        return response()->json(['data' => ['order' => (new OrderResource($order->refresh()->load(['items', 'history'])))->full(), 'payment' => $payment]]);
    }

    /**
     * Cancel order
     *
     * Only while `pending_payment` / `payment_failed` (also cancels the PaymentIntent).
     *
     * @urlParam number string required Example: AG-10001
     */
    public function cancel(Request $request, string $number): JsonResponse
    {
        $order = $this->find($request, $number);
        $this->orders->cancelUnpaid($order, 'Cancelled by customer');

        return response()->json(['data' => (new OrderResource($order->refresh()->load(['items', 'history'])))->full()]);
    }

    /**
     * Reorder
     *
     * Returns cart lines for still-available items; the client puts them back in its cart and re-quotes.
     *
     * @urlParam number string required Example: AG-10001
     */
    public function reorder(Request $request, string $number): JsonResponse
    {
        return response()->json(['data' => $this->orders->reorderLines($this->find($request, $number))]);
    }

    private function find(Request $request, string $number): Order
    {
        return $request->user()->orders()->with(['items.product', 'items.ring', 'items.stone', 'history'])
            ->where('order_number', strtoupper($number))->firstOrFail();
    }
}
