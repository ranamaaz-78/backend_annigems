<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\CurrencyService;
use App\Services\GoldRateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/** @group Admin: Dashboard */
class DashboardController extends Controller
{
    public function __invoke(GoldRateService $gold, CurrencyService $fx): JsonResponse
    {
        $paid = fn () => Order::whereIn('status', ['paid', 'partially_refunded', 'refunded'])->whereNotNull('paid_at');
        $revenue = fn (Carbon $from) => (int) $paid()->where('paid_at', '>=', $from)->sum('total_eur');
        $paidCount30 = $paid()->where('paid_at', '>=', now()->subDays(30))->count();

        // Revenue chart: last 30 days (EUR).
        $rows = $paid()->where('paid_at', '>=', now()->subDays(29)->startOfDay())->get(['paid_at', 'total_eur']);
        $byDay = $rows->groupBy(fn ($o) => $o->paid_at->toDateString())->map->sum('total_eur');
        $chart = collect(range(29, 0))->map(fn ($i) => now()->subDays($i)->toDateString())
            ->map(fn ($d) => ['date' => $d, 'revenue_eur' => (int) ($byDay[$d] ?? 0)]);

        return response()->json(['data' => [
            'kpis' => [
                'revenue_today' => $revenue(now()->startOfDay()),
                'revenue_7d' => $revenue(now()->subDays(7)),
                'revenue_30d' => $revenue(now()->subDays(30)),
                'paid_orders_30d' => $paidCount30,
                'paid_orders_total' => $paid()->count(),
                'average_order_value_30d' => $paidCount30 ? intdiv($revenue(now()->subDays(30)), $paidCount30) : 0,
                'new_customers_30d' => User::where('created_at', '>=', now()->subDays(30))->count(),
                'customers_total' => User::count(),
            ],
            'orders_by_status' => Order::selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status'),
            'orders_by_stage' => Order::whereIn('status', ['paid', 'partially_refunded'])->selectRaw('stage, count(*) as c')->groupBy('stage')->pluck('c', 'stage'),
            'to_craft' => Order::whereIn('status', ['paid', 'partially_refunded'])->whereIn('stage', ['placed', 'crafting'])
                ->oldest('paid_at')->limit(10)->get()->map(fn ($o) => $this->orderRow($o, $fx)),
            'recent_orders' => Order::latest('id')->limit(8)->get()->map(fn ($o) => $this->orderRow($o, $fx)),
            'low_stock' => Product::where('track_stock', true)->where('is_active', true)->where('stock_qty', '<=', 3)
                ->orderBy('stock_qty')->limit(10)->get(['id', 'name', 'legacy_id', 'stock_qty']),
            'stock_issues' => Order::where('stock_issue', true)->whereIn('status', ['paid', 'partially_refunded'])->count(),
            'gold' => $gold->status(),
            'fx' => $fx->status() + ['currencies' => $fx->summary()],
            'revenue_chart' => $chart,
            'stripe_mode' => str_starts_with((string) config('services.stripe.secret'), 'sk_live') ? 'live' : 'test',
        ]]);
    }

    private function orderRow(Order $o, CurrencyService $fx): array
    {
        return [
            'order_number' => $o->order_number, 'customer' => $o->ship_name, 'status' => $o->status, 'stage' => $o->stage,
            'total' => $fx->money($o->total, $o->currency), 'created_at' => $o->created_at->toIso8601String(),
            'paid_at' => $o->paid_at?->toIso8601String(),
        ];
    }
}
