<?php

namespace App\Http\Controllers\Admin\B2b;

use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use App\Models\CommissionPayout;
use App\Services\CurrencyService;
use App\Support\B2bScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Commission payouts to sales persons (EUR). Recorded by staff with b2b.payouts;
 * sales persons can see their own.
 *
 * @group Admin: B2B
 */
class PayoutController extends Controller
{
    public function __construct(private CurrencyService $fx) {}

    public function index(Request $request): JsonResponse
    {
        $q = CommissionPayout::with(['salesRep:id,name', 'creator:id,name'])->latest('paid_at')->latest('id');
        B2bScope::apply($q, $request);
        if ($request->filled('sales_rep_id') && B2bScope::repId($request) === null) {
            $q->where('sales_rep_id', $request->integer('sales_rep_id'));
        }
        if ($request->filled('from')) {
            $q->where('paid_at', '>=', $request->date('from')->toDateString());
        }
        if ($request->filled('to')) {
            $q->where('paid_at', '<=', $request->date('to')->toDateString());
        }
        $page = $q->paginate(min(100, max(1, $request->integer('per_page', 20))));

        return response()->json([
            'data' => collect($page->items())->map(fn (CommissionPayout $p) => $this->row($p)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
        ]);
    }

    private function row(CommissionPayout $p): array
    {
        return [
            'id' => $p->id,
            'sales_rep' => $p->salesRep ? ['id' => $p->salesRep->id, 'name' => $p->salesRep->name] : null,
            'amount' => $this->fx->money($p->amount_eur, 'EUR'),
            'paid_at' => $p->paid_at->toDateString(),
            'method' => $p->method,
            'reference' => $p->reference,
            'note' => $p->note,
            'created_by' => $p->creator?->name,
            'created_at' => $p->created_at->toIso8601String(),
        ];
    }

    /** @bodyParam amount integer required EUR minor units (cents). Example: 25000 */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sales_rep_id' => ['required', 'integer'],
            'amount' => ['required', 'integer', 'min:1'],
            'paid_at' => ['required', 'date', 'before_or_equal:today'],
            'method' => ['nullable', 'string', 'max:60'],
            'reference' => ['nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:2000'],
        ], ['amount.min' => 'Enter the amount paid.']);
        if (! AdminUser::whereKey($data['sales_rep_id'])->whereHas('roles', fn ($r) => $r->where('name', SalesRepController::ROLE))->exists()) {
            throw ValidationException::withMessages(['sales_rep_id' => 'Please choose a sales person.']);
        }
        $payout = CommissionPayout::create([
            'sales_rep_id' => $data['sales_rep_id'], 'amount_eur' => $data['amount'], 'paid_at' => $data['paid_at'],
            'method' => $data['method'] ?? null, 'reference' => $data['reference'] ?? null, 'note' => $data['note'] ?? null,
            'created_by' => $request->user('admin')->id,
        ]);

        return response()->json(['data' => $this->row($payout->load(['salesRep', 'creator'])), 'message' => 'Payout recorded.'], 201);
    }

    public function destroy(int $id): JsonResponse
    {
        CommissionPayout::findOrFail($id)->delete();

        return response()->json(['message' => 'Payout deleted.']);
    }
}
