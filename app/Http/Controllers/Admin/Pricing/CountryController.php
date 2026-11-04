<?php

namespace App\Http\Controllers\Admin\Pricing;

use App\Http\Controllers\Admin\CrudController;
use App\Models\Country;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** @group Admin: Pricing */
class CountryController extends CrudController
{
    protected string $model = Country::class;

    protected array $searchable = ['code', 'name'];

    protected array $sortable = ['id', 'name', 'code', 'sort_order'];

    protected string $defaultSort = 'sort_order';

    protected function rules(Request $request, ?Model $model = null): array
    {
        return [
            'code' => ['required', 'alpha', 'size:2', Rule::unique('countries', 'code')->ignore($model?->id)],
            'name' => ['required', 'string', 'max:120'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer'],
        ];
    }

    protected function prepare(array $data, Request $request, ?Model $model = null): array
    {
        $data['code'] = strtoupper($data['code']);
        $data['sort_order'] ??= 0;

        return $data;
    }
}
