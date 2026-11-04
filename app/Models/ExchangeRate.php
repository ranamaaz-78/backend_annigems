<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExchangeRate extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['rate' => 'decimal:8', 'fetched_at' => 'datetime'];
}
