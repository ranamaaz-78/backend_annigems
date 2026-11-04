<?php

namespace App\Http\Controllers\Admin\Catalog;

use App\Http\Controllers\Admin\CrudController;
use App\Models\Product;
use App\Models\Setting;
use App\Support\Media;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * @group Admin: Catalog
 *
 * Products. Prices are EUR minor units. `images` is the ordered gallery (first = main image).
 */
class ProductController extends CrudController
{
    protected string $model = Product::class;

    protected array $searchable = ['name', 'subtitle', 'sku', 'slug', 'legacy_id'];

    protected array $sortable = ['id', 'name', 'price', 'stock_qty', 'rating', 'featured_sort', 'new_arrival_sort', 'created_at'];

    protected array $with = ['images', 'category:id,name,slug'];

    protected function filter(Builder $query, Request $request): void
    {
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }
        if ($request->boolean('featured')) {
            $query->where('is_featured', true);
        }
        if ($request->boolean('new_arrival')) {
            $query->where('is_new_arrival', true);
        }
        if ($request->boolean('low_stock')) {
            $query->where('track_stock', true)->where('stock_qty', '<=', 3);
        }
    }

    protected function rules(Request $request, ?Model $model = null): array
    {
        return [
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:190'],
            'slug' => ['nullable', 'alpha_dash', 'max:190', Rule::unique('products', 'slug')->ignore($model?->id)],
            'legacy_id' => ['nullable', 'string', 'max:40', Rule::unique('products', 'legacy_id')->ignore($model?->id)],
            'sku' => ['nullable', 'string', 'max:64', Rule::unique('products', 'sku')->ignore($model?->id)],
            'subtitle' => ['nullable', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:10000'],
            'price' => ['required', 'integer', 'min:0'],
            'compare_at_price' => ['nullable', 'integer', 'min:0'],
            'badge' => ['nullable', Rule::in(Product::BADGES)],
            'metal' => ['nullable', 'string', 'max:80'],
            'stone' => ['nullable', 'string', 'max:120'],
            'weight' => ['nullable', 'string', 'max:40'],
            'details' => ['nullable', 'array'],
            'details.*' => ['nullable', 'string', 'max:255'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['nullable', 'string', 'max:60'],
            'rating' => ['nullable', 'numeric', 'between:0,5'],
            'reviews_count' => ['nullable', 'integer', 'min:0'],
            'has_sizes' => ['boolean'],
            'sizes' => ['nullable', 'array'],
            'sizes.*' => ['string', 'max:10'],
            'stock_qty' => ['required', 'integer'],
            'track_stock' => ['boolean'],
            'is_customizable' => ['boolean'],
            'is_featured' => ['boolean'],
            'featured_sort' => ['nullable', 'integer'],
            'is_new_arrival' => ['boolean'],
            'new_arrival_sort' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
            'published_at' => ['nullable', 'date'],
            'images' => ['nullable', 'array', 'max:20'],
            'images.*.path' => ['required', 'string', 'max:255'],
            'images.*.alt' => ['nullable', 'string', 'max:190'],
        ];
    }

    protected function messages(): array
    {
        return ['price.required' => 'Please enter a price.', 'category_id.required' => 'Please choose a category.'];
    }

    protected function prepare(array $data, Request $request, ?Model $model = null): array
    {
        $data['slug'] = $data['slug'] ?? ($model?->slug ?: Str::slug($data['name']));
        $data['details'] = array_values(array_filter($data['details'] ?? [], fn ($v) => $v !== null && trim($v) !== ''));
        $data['tags'] = array_values(array_filter($data['tags'] ?? [], fn ($v) => $v !== null && trim($v) !== ''));
        if (! empty($data['has_sizes'])) {
            $data['sizes'] = array_values($data['sizes'] ?? []) ?: Setting::get('catalog.default_ring_sizes', []);
        } else {
            $data['sizes'] = null;
        }
        if (! $model && empty($data['published_at'])) {
            $data['published_at'] = now();
        }
        foreach (['rating' => 0, 'reviews_count' => 0, 'featured_sort' => 0, 'new_arrival_sort' => 0] as $k => $default) {
            $data[$k] ??= $default;
        }
        unset($data['images']);

        return $data;
    }

    protected function afterSave(Model $model, array $data, Request $request): void
    {
        if ($request->has('images')) {
            DB::transaction(function () use ($model, $request) {
                $model->images()->delete();
                foreach (array_values($request->input('images', [])) as $i => $img) {
                    $model->images()->create(['path' => Media::normalize($img['path']), 'alt' => $img['alt'] ?? $model->name, 'sort_order' => $i]);
                }
            });
            activity('products')->causedBy(auth('admin')->user())->performedOn($model)->log('Images updated');
        }
    }

    protected function transform(Model $p): array
    {
        return array_merge($p->toArray(), [
            'in_stock' => $p->in_stock,
            'images' => $p->images->map(fn ($i) => ['id' => $i->id, 'path' => $i->path, 'url' => Media::url($i->path), 'alt' => $i->alt])->values(),
            'image_url' => Media::url($p->images->first()?->path),
            'published_at' => $p->published_at?->toIso8601String(),
        ]);
    }

    /** Bulk reorder of featured / new-arrival lists: {field: featured_sort|new_arrival_sort, ids: [..]} */
    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate(['field' => ['required', 'in:featured_sort,new_arrival_sort'], 'ids' => ['required', 'array'], 'ids.*' => ['integer']]);
        foreach ($data['ids'] as $i => $id) {
            Product::whereKey($id)->update([$data['field'] => $i]);
        }

        return response()->json(['message' => 'Order saved.']);
    }

    public function options(): JsonResponse
    {
        return response()->json(['data' => [
            'badges' => Product::BADGES,
            'default_sizes' => Setting::get('catalog.default_ring_sizes', []),
        ]]);
    }
}
