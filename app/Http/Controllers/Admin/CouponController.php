<?php

namespace App\Http\Controllers\Admin;

use App\Models\Coupon;
use App\Models\Order;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** @group Admin: Coupons */
class CouponController extends CrudController
{
    protected string $model = Coupon::class;

    protected array $searchable = ['code', 'label'];

    protected array $sortable = ['id', 'code', 'used_count', 'expires_at', 'created_at'];

    protected function rules(Request $request, ?Model $model = null): array
    {
        return [
            'code' => ['required', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique('coupons', 'code')->ignore($model?->id)->whereNull('deleted_at')],
            'label' => ['nullable', 'string', 'max:120'],
            'type' => ['required', 'in:percent,fixed'],
            'value' => ['required', 'integer', 'min:1', $request->input('type') === 'percent' ? 'max:100' : 'max:100000000'],
            'min_subtotal' => ['nullable', 'integer', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'per_user_limit' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['boolean'],
        ];
    }

    protected function messages(): array
    {
        return ['code.regex' => 'Use letters, numbers, dashes or underscores only.', 'value.max' => 'A percent coupon cannot exceed 100%.'];
    }

    protected function prepare(array $data, Request $request, ?Model $model = null): array
    {
        $data['code'] = strtoupper($data['code']);

        return $data;
    }

    protected function transform(Model $c): array
    {
        $paid = Order::where('coupon_code', $c->code)->whereIn('status', ['paid', 'partially_refunded', 'refunded']);

        return $c->toArray() + [
            'stats' => [
                'paid_orders' => (clone $paid)->count(),
                'discount_eur' => (int) (clone $paid)->get(['discount', 'exchange_rate'])->sum(fn ($o) => (int) round($o->discount / (float) $o->exchange_rate)),
                'revenue_eur' => (int) (clone $paid)->sum('total_eur'),
                'pending_orders' => Order::where('coupon_code', $c->code)->whereIn('status', ['pending_payment', 'payment_failed'])->count(),
            ],
        ];
    }
}
