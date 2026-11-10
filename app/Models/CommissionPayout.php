<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A commission payment made to a sales person (EUR minor units). */
class CommissionPayout extends Model
{
    use LogsChanges;

    protected $guarded = ['id'];

    protected $casts = ['amount_eur' => 'integer', 'paid_at' => 'date'];

    public function salesRep(): BelongsTo
    {
        return $this->belongsTo(AdminUser::class, 'sales_rep_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(AdminUser::class, 'created_by');
    }
}
