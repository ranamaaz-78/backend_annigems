<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use LogsChanges, SoftDeletes;

    public const BADGES = ['Bestseller', 'Sale', 'New', 'Limited', 'Iconic'];

    protected $guarded = ['id'];

    protected $casts = [
        'price' => 'integer',
        'compare_at_price' => 'integer',
        'details' => 'array',
        'tags' => 'array',
        'sizes' => 'array',
        'rating' => 'float',
        'reviews_count' => 'integer',
        'has_sizes' => 'boolean',
        'stock_qty' => 'integer',
        'track_stock' => 'boolean',
        'is_customizable' => 'boolean',
        'is_featured' => 'boolean',
        'is_new_arrival' => 'boolean',
        'is_active' => 'boolean',
        'published_at' => 'datetime',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order')->orderBy('id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
    }

    public function getInStockAttribute(): bool
    {
        return ! $this->track_stock || $this->stock_qty > 0;
    }

    public function getMainImageAttribute(): ?string
    {
        return $this->images->first()?->path;
    }

    /** Visible on the storefront: active, published, in an active category. */
    public function scopeVisible(Builder $q): Builder
    {
        return $q->where('is_active', true)
            ->where(fn ($w) => $w->whereNull('published_at')->orWhere('published_at', '<=', now()))
            ->whereHas('category', fn ($c) => $c->where('is_active', true));
    }

    public function isPurchasable(): bool
    {
        return $this->is_active && $this->category?->is_active && (! $this->published_at || $this->published_at->isPast());
    }

    /** Resolve by slug or storefront legacy id (r1, n1…). */
    public static function findBySlugOrLegacy(string $key): ?self
    {
        return static::where('slug', $key)->orWhere('legacy_id', $key)->first();
    }
}
