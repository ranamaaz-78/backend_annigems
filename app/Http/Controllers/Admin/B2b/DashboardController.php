<?php

namespace App\Http\Controllers\Admin\B2b;

use App\Http\Controllers\Controller;
use App\Models\BusinessProfile;
use App\Models\SalesRep;
use App\Services\B2bReportService;
use App\Support\B2bScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** @group Admin: B2B */
class DashboardController extends Controller
{
    /**
     * B2B dashboard: KPIs, commission balance and sales per day/week/month (scoped for sales persons).
     *
     * @queryParam from date Example: 2026-10-01
     * @queryParam to date Example: 2026-10-31
     * @queryParam group string day, week or month. Example: day
     */
    public function __invoke(Request $request, B2bReportService $reports): JsonResponse
    {
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date'], 'group' => ['nullable', 'in:day,week,month']]);
        $rep = B2bScope::repId($request);
        [$from, $to, $group] = $reports->window($request->input('from'), $request->input('to'), $request->input('group'));
        $businesses = BusinessProfile::query()->when($rep !== null, fn ($q) => $q->where('sales_rep_id', $rep));

        return response()->json(['data' => [
            'scoped' => $rep !== null,
            'kpis' => [
                'businesses' => (clone $businesses)->count(),
                'active_businesses' => (clone $businesses)->whereHas('user', fn ($u) => $u->where('is_active', true)->whereNull('deleted_at'))->count(),
                'sales_reps' => $rep === null ? SalesRep::count() : null,
                'awaiting_approval' => $reports->orders($rep)->where('status', 'awaiting_approval')->count(),
                'in_progress' => $reports->orders($rep)->where('status', 'confirmed')->where(fn ($q) => $q->whereNull('stage')->orWhere('stage', '!=', 'delivered'))->count(),
            ],
            'commission' => $reports->presentTotals($reports->sumTotals($reports->commissionTotals($rep))),
            'period' => $reports->period($from, $to, $group, $rep),
        ]]);
    }
}
