<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * @group Wishlist
 *
 * Product ids may be numeric ids or storefront legacy ids (`r1`).
 *
 * @authenticated
 */
class WishlistController extends Controller
{
    /** List wishlist products */
    public function index(Request $request): AnonymousResourceCollection
    {
        return $this->list($request);
    }

    /**
     * Add product
     *
     * @urlParam productId string required Example: 1
     */
    public function store(Request $request, string $productId): AnonymousResourceCollection
    {
        $product = $this->resolve($productId);
        abort_unless($product, 404, 'Product not found.');
        $request->user()->wishlistProducts()->syncWithoutDetaching([$product->id]);

        return $this->list($request);
    }

    /**
     * Remove product
     *
     * @urlParam productId string required Example: 1
     */
    public function destroy(Request $request, string $productId): AnonymousResourceCollection
    {
        if ($product = $this->resolve($productId)) {
            $request->user()->wishlistProducts()->detach($product->id);
        }

        return $this->list($request);
    }

    /**
     * Sync guest wishlist
     *
     * Merges the guest (local) wishlist after login and returns the full list.
     *
     * @bodyParam product_ids string[] required Example: ["r1", 5]
     */
    public function sync(Request $request): AnonymousResourceCollection
    {
        $data = $request->validate(['product_ids' => ['present', 'array', 'max:200'], 'product_ids.*' => ['required']]);
        $ids = collect($data['product_ids'])->map(fn ($id) => $this->resolve((string) $id)?->id)->filter()->unique();
        $request->user()->wishlistProducts()->syncWithoutDetaching($ids->all());

        return $this->list($request);
    }

    private function list(Request $request): AnonymousResourceCollection
    {
        $products = $request->user()->wishlistProducts()->visible()->with(['images', 'category'])
            ->orderByPivot('created_at', 'desc')->get();

        return ProductResource::collection($products);
    }

    private function resolve(string $id): ?Product
    {
        return Product::visible()->where(fn ($q) => ctype_digit($id) ? $q->whereKey((int) $id)->orWhere('legacy_id', $id) : $q->where('legacy_id', $id)->orWhere('slug', $id))->first();
    }
}
