<?php

namespace App\Http\Controllers\Admin\Pricing;

use App\Http\Controllers\Admin\CrudController;
use App\Models\ShippingMethod;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** @group Admin: Pricing */
class ShippingMethodController extends CrudController
{
    protected string $model = ShippingMethod::class;

    protected array $searchable = ['code', 'name'];

    protected array $sortable = ['id', 'name', 'price', 'sort_order'];

    protected string $defaultSort = 'sort_order';

    protected function rules(Request $request, ?Model $model = null): array
    {
        return [
            'code' => ['required', 'alpha_dash', 'max:40', Rule::unique('shipping_methods', 'code')->ignore($model?->id)],
            'name' => ['required', 'string', 'max:120'],
            'delivery_time' => ['nullable', 'string', 'max:120'],
            'price' => ['required', 'integer', 'min:0'],
            'free_over_threshold' => ['boolean'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer'],
        ];
    }

    protected function prepare(array $data, Request $request, ?Model $model = null): array
    {
        $data['sort_order'] ??= 0;

        return $data;
    }
}
