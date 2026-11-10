<?php

namespace App\Http\Controllers\Admin\B2b;

use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use App\Services\B2bReportService;
use App\Support\B2bScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Commission report (EUR). Lifetime per sales person: pending (not delivered), earned (delivered),
 * void (cancelled), paid out and balance. Plus orders/sales/commission for a period by
 * day, week or month, per business. Sales persons only get their own numbers.
 *
 * @group Admin: B2B
 */
class CommissionController extends Controller
{
    /**
     * @queryParam sales_rep_id integer Staff only: one sales person. Example: 5
     * @queryParam from date Example: 2026-10-01
     * @queryParam to date Example: 2026-10-31
     * @queryParam group string day, week or month. Example: week
     */
    public function index(Request $request, B2bReportService $reports): JsonResponse
    {
        $request->validate([
            'sales_rep_id' => ['nullable', 'integer'], 'from' => ['nullable', 'date'], 'to' => ['nullable', 'date'],
            'group' => ['nullable', 'in:day,week,month'],
        ]);
        $rep = B2bScope::repId($request) ?? ($request->filled('sales_rep_id') ? $request->integer('sales_rep_id') : null);
        [$from, $to, $group] = $reports->window($request->input('from'), $request->input('to'), $request->input('group'));
        $totals = $reports->commissionTotals($rep);
        $names = AdminUser::whereIn('id', $totals->keys())->with('salesRep')->get()->keyBy('id');

        return response()->json(['data' => [
            'scoped' => B2bScope::repId($request) !== null,
            'sales_rep_id' => $rep,
            'summary' => $reports->presentTotals($reports->sumTotals($totals)),
            'by_rep' => $totals->map(fn ($t, $id) => [
                'sales_rep_id' => $id,
                'name' => $names->get($id)?->name,
                'commission_rate' => (float) ($names->get($id)?->salesRep?->commission_rate ?? 0),
            ] + $reports->presentTotals($t))->sortBy('name')->values(),
            'period' => $reports->period($from, $to, $group, $rep),
        ]]);
    }
}
