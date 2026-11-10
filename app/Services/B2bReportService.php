<?php

namespace App\Services;

use App\Models\CommissionPayout;
use App\Models\Order;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * B2B numbers for the admin: commission balances per sales person and sales/commission per period.
 * All report amounts are EUR minor units. Commission: pending (placed, not delivered), earned
 * (delivered), void (cancelled); balance = earned − paid out.
 */
class B2bReportService
{
    public const GROUPS = ['day', 'week', 'month'];

    public function __construct(private CurrencyService $fx) {}

    public function orders(?int $repId = null): Builder
    {
        return Order::query()->where('account_type', 'business')
            ->when($repId !== null, fn ($q) => $q->where('sales_rep_id', $repId));
    }

    /**
     * Lifetime commission per sales person.
     *
     * @return Collection<int, array{pending:int, earned:int, void:int, paid:int, balance:int}> keyed by admin user id
     */
    public function commissionTotals(?int $repId = null): Collection
    {
        $rows = $this->orders($repId)->whereNotNull('sales_rep_id')->whereNotNull('commission_amount_eur')
            ->get(['sales_rep_id', 'status', 'stage', 'commission_amount', 'commission_amount_eur', 'account_type'])
            ->groupBy('sales_rep_id');
        $paid = CommissionPayout::query()->when($repId !== null, fn ($q) => $q->where('sales_rep_id', $repId))
            ->selectRaw('sales_rep_id, sum(amount_eur) as total')->groupBy('sales_rep_id')->pluck('total', 'sales_rep_id');

        return $rows->keys()->merge($paid->keys())->unique()->mapWithKeys(function ($id) use ($rows, $paid) {
            $orders = $rows->get($id, collect());
            $sum = fn (string $state) => (int) $orders->filter(fn (Order $o) => $o->commissionState() === $state)->sum('commission_amount_eur');
            $earned = $sum('earned');
            $out = (int) ($paid[$id] ?? 0);

            return [(int) $id => ['pending' => $sum('pending'), 'earned' => $earned, 'void' => $sum('void'), 'paid' => $out, 'balance' => $earned - $out]];
        });
    }

    /** Sum of commissionTotals() rows. */
    public function sumTotals(Collection $totals): array
    {
        return collect(['pending', 'earned', 'void', 'paid', 'balance'])
            ->mapWithKeys(fn ($k) => [$k => (int) $totals->sum($k)])->all();
    }

    /** Period window from request input (defaults: last 30 days, by day). */
    public function window(?string $from, ?string $to, ?string $group): array
    {
        $to = $to ? Carbon::parse($to)->endOfDay() : now()->endOfDay();
        $from = $from ? Carbon::parse($from)->startOfDay() : $to->copy()->subDays(29)->startOfDay();
        if ($from->gt($to)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }

        return [$from, $to, in_array($group, self::GROUPS, true) ? $group : 'day'];
    }

    /**
     * Orders placed in the window: series per day/week/month, plus per business and per sales person.
     * Cancelled orders are left out of sales and commission.
     */
    public function period(Carbon $from, Carbon $to, string $group, ?int $repId = null, ?int $businessUserId = null): array
    {
        $orders = $this->orders($repId)->whereBetween('created_at', [$from, $to])
            ->when($businessUserId !== null, fn ($q) => $q->where('user_id', $businessUserId))
            ->with('salesRep:id,name')
            ->get(['id', 'order_number', 'user_id', 'company_name', 'sales_rep_id', 'status', 'stage', 'account_type', 'total_eur', 'commission_amount', 'commission_amount_eur', 'created_at']);
        $live = $orders->where('status', '!=', 'cancelled');
        $eur = fn (int $v) => $this->fx->money($v, 'EUR');

        $key = fn (Carbon $d) => match ($group) {
            'week' => $d->copy()->startOfWeek()->toDateString(),
            'month' => $d->format('Y-m'),
            default => $d->toDateString(),
        };
        $buckets = [];
        for ($d = $from->copy(); $d->lte($to); $d = match ($group) {
            'week' => $d->copy()->startOfWeek()->addWeek(),
            'month' => $d->copy()->startOfMonth()->addMonth(),
            default => $d->copy()->addDay(),
        }) {
            $buckets[$key($d)] = ['period' => $key($d), 'orders' => 0, 'sales_eur' => 0, 'commission_eur' => 0];
        }
        foreach ($live as $o) {
            $k = $key($o->created_at);
            if (isset($buckets[$k])) {
                $buckets[$k]['orders']++;
                $buckets[$k]['sales_eur'] += $o->total_eur;
                $buckets[$k]['commission_eur'] += (int) $o->commission_amount_eur;
            }
        }

        $summarise = fn (Collection $g) => [
            'orders' => $g->count(),
            'sales' => $eur((int) $g->sum('total_eur')),
            'commission' => $eur((int) $g->sum('commission_amount_eur')),
        ];

        return [
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'group' => $group],
            'totals' => $summarise($live) + ['cancelled' => $orders->count() - $live->count()],
            'series' => array_values($buckets),
            'by_business' => $live->groupBy('user_id')->map(fn (Collection $g, $userId) => ['user_id' => (int) $userId, 'company_name' => $g->first()->company_name] + $summarise($g) + [
                'last_order_at' => $g->max('created_at')?->toIso8601String(),
            ])->sortByDesc(fn ($r) => $r['sales']['amount'])->values(),
            'by_rep' => $live->whereNotNull('sales_rep_id')->groupBy('sales_rep_id')->map(fn (Collection $g, $id) => ['sales_rep_id' => (int) $id, 'name' => $g->first()->salesRep?->name] + $summarise($g))
                ->sortByDesc(fn ($r) => $r['sales']['amount'])->values(),
            'orders' => $orders->sortByDesc('id')->take(100)->map(fn (Order $o) => [
                'order_number' => $o->order_number,
                'company_name' => $o->company_name,
                'sales_rep' => $o->salesRep?->name,
                'status' => $o->status,
                'stage' => $o->stage,
                'total_eur' => $eur((int) $o->total_eur),
                'commission_eur' => $o->commission_amount_eur === null ? null : $eur((int) $o->commission_amount_eur),
                'commission_state' => $o->commissionState(),
                'created_at' => $o->created_at->toIso8601String(),
            ])->values(),
        ];
    }

    /** EUR money objects for a commissionTotals() row. */
    public function presentTotals(array $t): array
    {
        return array_map(fn ($v) => $this->fx->money((int) $v, 'EUR'), $t);
    }
}
