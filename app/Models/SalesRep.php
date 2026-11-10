<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Sales person profile of an admin user (role Sales Person): phone and commission %. */
class SalesRep extends Model
{
    use LogsChanges;

    protected $guarded = ['id'];

    protected $casts = ['commission_rate' => 'float'];

    public function adminUser(): BelongsTo
    {
        return $this->belongsTo(AdminUser::class);
    }
}
