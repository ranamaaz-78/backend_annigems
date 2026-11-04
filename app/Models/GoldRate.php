<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GoldRate extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['rate_per_oz' => 'integer', 'fetched_at' => 'datetime', 'raw' => 'array'];
}
