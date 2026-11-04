<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\ReviewResource;
use App\Models\Product;
use App\Models\ProductReview;
use App\Services\CurrencyService;
use App\Support\Content;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * @group Catalog
 *
 * @unauthenticated
 */
class CatalogController extends Controller
{
    public function __construct(private CurrencyService $currency) {}

    /** List categories (active, with product counts). */
    public function categories(): AnonymousResourceCollection
    {
        return CategoryResource::collection(StoreController::categoriesQuery()->get());
    }

    /**
     * List products
     *
     * Paginated. Prices in the request currency (`X-Currency`).
     *
     * @queryParam category string Category slug. Example: rings
     * @queryParam stone string[] Stone filter values (Diamond, Ruby, Sapphire, Emerald, No Stone). Example: ["Ruby"]
     * @queryParam min_price integer Minimum price in MINOR units of the request currency. Example: 50000
     * @queryParam max_price integer Maximum price in MINOR units of the request currency. Example: 200000
     * @queryParam search string Text search. Example: solitaire
     * @queryParam featured boolean Only featured products. Example: 1
     * @queryParam new boolean Only new arrivals. Example: 0
     * @queryParam in_stock boolean Only in-stock products. Example: 0
     * @queryParam sort string One of featured, price-asc, price-desc, rating, newest. Example: featured
     * @queryParam per_page integer Max 50. Example: 12
     */
    public function products(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'category' => ['nullable', 'string'],
            'stone' => ['nullable', 'array'],
            'stone.*' => ['string'],
            'min_price' => ['nullable', 'integer', 'min:0'],
            'max_price' => ['nullable', 'integer', 'min:0'],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:featured,price-asc,price-desc,rating,newest'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $q = Product::visible()->with(['images', 'category']);

        if ($cat = $request->input('category')) {
            $q->whereHas('category', fn ($c) => $c->where('slug', $cat));
        }
        if ($stones = array_filter((array) $request->input('stone', []))) {
            $q->where(function ($w) use ($stones) {
                foreach ($stones as $stone) {
                    $stone === 'No Stone'
                        ? $w->orWhere('stone', 'No Stone')->orWhereNull('stone')
                        : $w->orWhere('stone', 'like', '%'.$stone.'%');
                }
            });
        }
        // Price bounds come in the request currency; compare in EUR.
        if ($request->filled('min_price')) {
            $q->where('price', '>=', (int) floor($request->integer('min_price') / $this->currency->rate()));
        }
        if ($request->filled('max_price')) {
            $q->where('price', '<=', (int) ceil($request->integer('max_price') / $this->currency->rate()));
        }
        if ($s = $request->input('search')) {
            $this->applySearch($q, $s);
        }
        if ($request->boolean('featured')) {
            $q->where('is_featured', true);
        }
        if ($request->boolean('new')) {
            $q->where('is_new_arrival', true);
        }
        if ($request->boolean('in_stock')) {
            $q->where(fn ($w) => $w->where('track_stock', false)->orWhere('stock_qty', '>', 0));
        }

        match ($request->input('sort', 'featured')) {
            'price-asc' => $q->orderBy('price')->orderBy('id'),
            'price-desc' => $q->orderByDesc('price')->orderBy('id'),
            'rating' => $q->orderByDesc('rating')->orderByDesc('reviews_count')->orderBy('id'),
            'newest' => $q->orderByDesc('published_at')->orderByDesc('id'),
            default => $q->orderByDesc('is_featured')->orderBy('featured_sort')->orderBy('id'),
        };

        return ProductResource::collection($q->paginate($request->integer('per_page', 12) ?: 12)->withQueryString());
    }

    /**
     * Product detail
     *
     * Accepts the slug or the storefront legacy id (`r1`, `n1`…).
     *
     * @urlParam slugOrLegacyId string required Example: r1
     */
    public function show(string $slugOrLegacyId): JsonResponse
    {
        $product = Product::visible()->with(['images', 'category'])
            ->where(fn ($q) => $q->where('slug', $slugOrLegacyId)->orWhere('legacy_id', $slugOrLegacyId))
            ->first();
        abort_unless($product, 404, 'Product not found.');

        $related = Product::visible()->with(['images', 'category'])
            ->where('category_id', $product->category_id)->whereKeyNot($product->id)
            ->orderByDesc('is_featured')->orderBy('id')->limit(4)->get();

        $reviews = ProductReview::where('is_active', true)
            ->where(fn ($q) => $q->where('product_id', $product->id)->orWhereNull('product_id'))
            ->orderByRaw('product_id is null')->orderBy('sort_order')->get();

        return response()->json(['data' => array_merge((new ProductResource($product))->full()->resolve(), [
            'related' => ProductResource::collection($related)->resolve(),
            'reviews' => ReviewResource::collection($reviews)->resolve(),
            'rating_distribution' => Content::get('catalog.rating_distribution', []),
            'shipping_points' => Content::get('product.shipping_points', []),
            'care_instructions' => Content::get('product.care_instructions', []),
        ])]);
    }

    /**
     * Quick search
     *
     * Name, subtitle, tags and category; max 8 results.
     *
     * @queryParam q string required Example: ruby
     */
    public function search(Request $request): AnonymousResourceCollection
    {
        $request->validate(['q' => ['required', 'string', 'min:1', 'max:100']]);
        $q = Product::visible()->with(['images', 'category']);
        $this->applySearch($q, $request->input('q'));

        return ProductResource::collection($q->orderByDesc('is_featured')->orderBy('id')->limit(8)->get());
    }

    private function applySearch($q, string $term): void
    {
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], trim($term)).'%';
        $q->where(fn ($w) => $w->where('name', 'like', $like)
            ->orWhere('subtitle', 'like', $like)
            ->orWhere('tags', 'like', $like)
            ->orWhere('stone', 'like', $like)
            ->orWhereHas('category', fn ($c) => $c->where('name', 'like', $like)->orWhere('slug', 'like', $like)));
    }
}
