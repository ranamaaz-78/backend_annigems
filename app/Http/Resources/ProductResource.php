<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Services\CurrencyService;
use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
class ProductResource extends JsonResource
{
    public bool $full = false;

    public function full(): static
    {
        $this->full = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $money = app(CurrencyService::class);
        $gallery = $this->whenLoaded('images', fn () => $this->images->map(fn ($i) => Media::url($i->path))->values(), collect());

        $base = [
            'id' => $this->id,
            'legacy_id' => $this->legacy_id,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'name' => $this->name,
            'subtitle' => $this->subtitle,
            'category' => $this->whenLoaded('category', fn () => ['id' => $this->category->id, 'slug' => $this->category->slug, 'name' => $this->category->name]),
            'price' => $money->moneyFromEur($this->price),
            'compare_at_price' => $money->moneyFromEur($this->compare_at_price),
            'on_sale' => $this->compare_at_price !== null && $this->compare_at_price > $this->price,
            'badge' => $this->badge,
            'image' => $gallery->first(),
            'metal' => $this->metal,
            'stone' => $this->stone,
            'weight' => $this->weight,
            'rating' => $this->rating,
            'reviews_count' => $this->reviews_count,
            'in_stock' => $this->in_stock,
            'has_sizes' => $this->has_sizes,
            'is_customizable' => $this->is_customizable,
            'is_featured' => $this->is_featured,
            'is_new_arrival' => $this->is_new_arrival,
            'tags' => $this->tags ?? [],
        ];

        if (! $this->full) {
            return $base;
        }

        return $base + [
            'gallery' => $gallery,
            'sizes' => $this->has_sizes ? array_values($this->sizes ?? []) : [],
            'description' => $this->description,
            'details' => $this->details ?? [],
        ];
    }
}
