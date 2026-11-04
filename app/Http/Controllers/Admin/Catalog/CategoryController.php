<?php

namespace App\Http\Controllers\Admin\Catalog;

use App\Http\Controllers\Admin\CrudController;
use App\Models\Category;
use App\Support\Media;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** @group Admin: Catalog */
class CategoryController extends CrudController
{
    protected string $model = Category::class;

    protected array $searchable = ['name', 'slug'];

    protected array $sortable = ['id', 'name', 'sort_order'];

    protected string $defaultSort = 'sort_order';

    protected function filter(Builder $query, Request $request): void
    {
        $query->withCount('products');
    }

    protected function rules(Request $request, ?Model $model = null): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'alpha_dash', 'max:120', Rule::unique('categories', 'slug')->ignore($model?->id)],
            'image' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ];
    }

    protected function prepare(array $data, Request $request, ?Model $model = null): array
    {
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        $data['image'] = Media::normalize($data['image'] ?? null);
        $data['sort_order'] ??= 0;

        return $data;
    }

    protected function transform(Model $m): array
    {
        return $m->toArray() + ['image_url' => Media::url($m->image), 'products_count' => $m->products_count ?? $m->products()->count()];
    }

    public function destroy(int $id): JsonResponse
    {
        $cat = $this->find($id);
        if ($cat->products()->exists()) {
            throw ValidationException::withMessages(['category' => 'Move or delete the products of this category first.']);
        }
        $cat->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
