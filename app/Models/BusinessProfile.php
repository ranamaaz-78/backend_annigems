<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Company details of a business (B2B) account, its tier and the sales person who onboarded it. */
class BusinessProfile extends Model
{
    use LogsChanges;

    protected $guarded = ['id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function tier(): BelongsTo
    {
        return $this->belongsTo(B2bTier::class, 'tier_id');
    }

    public function salesRep(): BelongsTo
    {
        return $this->belongsTo(AdminUser::class, 'sales_rep_id');
    }
}
