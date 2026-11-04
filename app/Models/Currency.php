<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;

class Currency extends Model
{
    use LogsChanges;

    protected $guarded = ['id'];

    protected $casts = ['is_base' => 'boolean', 'is_active' => 'boolean', 'decimals' => 'integer'];
}
