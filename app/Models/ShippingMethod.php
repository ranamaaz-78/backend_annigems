<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;

class ShippingMethod extends Model
{
    use LogsChanges;

    protected $guarded = ['id'];

    protected $casts = ['price' => 'integer', 'free_over_threshold' => 'boolean', 'is_active' => 'boolean'];
}
