<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** B2B membership tier (Platinum, Gold, Silver…) with a discount % per category. */
class B2bTier extends Model
{
    use LogsChanges;

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean'];

    public function discounts(): HasMany
    {
        return $this->hasMany(B2bTierDiscount::class, 'tier_id');
    }

    public function businesses(): HasMany
    {
        return $this->hasMany(BusinessProfile::class, 'tier_id');
    }
}
