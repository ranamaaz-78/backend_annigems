<?php

namespace App\Http\Controllers\Admin\B2b;

use App\Http\Controllers\Admin\OrderController as AdminOrders;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderService;
use App\Support\B2bScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Business orders (cash on delivery). Listing/detail reuse the admin order presenter; sales persons
 * only see orders of their own businesses. Approve/reject/cancel need b2b.orders; stages and
 * tracking go through the regular order endpoints (orders.stage).
 *
 * @group Admin: B2B
 */
class OrderController extends Controller
{
    public function __construct(private AdminOrders $orders, private OrderService $service) {}

    public function index(Request $request): JsonResponse
    {
        $request->merge(['account_type' => 'business']);
        if (B2bScope::repId($request) !== null) {
            $request->merge(['sales_rep_id' => B2bScope::repId($request)]);
        }
        $q = $this->orders->query($request)->with('salesRep:id,name');
        if ($request->filled('user_id')) {
            $q->where('user_id', $request->integer('user_id'));
        }
        $page = $q->paginate(min(100, max(1, $request->integer('per_page', 20))));

        return response()->json([
            'data' => collect($page->items())->map(fn (Order $o) => $this->orders->row($o)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
        ]);
    }

    public function show(Request $request, string $number): JsonResponse
    {
        return response()->json(['data' => $this->orders->detail($this->find($request, $number))]);
    }

    public function approve(Request $request, string $number): JsonResponse
    {
        $order = $this->find($request, $number);
        $this->service->approveB2b($order, $request->user('admin'));

        return response()->json(['data' => $this->orders->detail($order->refresh()), 'message' => 'Order approved. The business has been emailed.']);
    }

    public function reject(Request $request, string $number): JsonResponse
    {
        $order = $this->find($request, $number);
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], ['reason.required' => 'Please give a reason for the business.']);
        $this->service->rejectB2b($order, $data['reason'], $request->user('admin'));

        return response()->json(['data' => $this->orders->detail($order->refresh()), 'message' => 'Order rejected.']);
    }

    public function cancel(Request $request, string $number): JsonResponse
    {
        $order = $this->find($request, $number);
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], ['reason.required' => 'Please give a reason for the business.']);
        $this->service->cancelB2b($order, $data['reason'], $request->user('admin'));

        return response()->json(['data' => $this->orders->detail($order->refresh()), 'message' => 'Order cancelled. Stock has been put back.']);
    }

    private function find(Request $request, string $number): Order
    {
        $order = Order::where('order_number', strtoupper($number))->where('account_type', 'business')->firstOrFail();
        B2bScope::authorize($order->sales_rep_id, $request);

        return $order;
    }
}
