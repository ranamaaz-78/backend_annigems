<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Discount % of a tier for one category; category_id null = Design Your Ring (custom rings). */
class B2bTierDiscount extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['percent' => 'float'];

    public function tier(): BelongsTo
    {
        return $this->belongsTo(B2bTier::class, 'tier_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
