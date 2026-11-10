<?php

namespace App\Support;

use App\Models\AdminUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Row-level scope of the B2B admin screens: a sales person (b2b.sales without b2b.view)
 * only sees their own businesses, orders, commissions and payouts. Everyone else sees all.
 */
class B2bScope
{
    /** Admin user id the request is limited to, or null for full access. */
    public static function repId(Request $request): ?int
    {
        $user = $request->user('admin');

        return $user instanceof AdminUser && $user->isScopedSalesRep() ? $user->id : null;
    }

    public static function apply(Builder $query, Request $request, string $column = 'sales_rep_id'): Builder
    {
        $rep = self::repId($request);

        return $rep === null ? $query : $query->where($column, $rep);
    }

    /** 404 when a scoped sales person opens a record of another sales person. */
    public static function authorize(?int $salesRepId, Request $request): void
    {
        $rep = self::repId($request);
        abort_if($rep !== null && $salesRepId !== $rep, 404);
    }
}
