<?php

namespace App\Http\Controllers\Admin\Catalog;

use App\Http\Controllers\Admin\CrudController;
use App\Models\ProductReview;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/** @group Admin: Catalog */
class ReviewController extends CrudController
{
    protected string $model = ProductReview::class;

    protected array $searchable = ['name', 'text', 'location'];

    protected array $sortable = ['id', 'name', 'rating', 'sort_order'];

    protected string $defaultSort = 'sort_order';

    protected array $with = ['product:id,name'];

    protected function filter(Builder $query, Request $request): void
    {
        if ($request->input('product_id') === 'generic') {
            $query->whereNull('product_id');
        } elseif ($request->filled('product_id')) {
            $query->where('product_id', $request->integer('product_id'));
        }
    }

    protected function rules(Request $request, ?Model $model = null): array
    {
        return [
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'name' => ['required', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'max:120'],
            'initials' => ['nullable', 'string', 'max:4'],
            'rating' => ['required', 'integer', 'between:1,5'],
            'text' => ['required', 'string', 'max:3000'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer'],
        ];
    }

    protected function prepare(array $data, Request $request, ?Model $model = null): array
    {
        $data['initials'] = $data['initials'] ?? collect(explode(' ', $data['name']))->map(fn ($p) => mb_substr($p, 0, 1))->take(2)->implode('');
        $data['sort_order'] ??= 0;

        return $data;
    }
}
