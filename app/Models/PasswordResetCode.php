<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PasswordResetCode extends Model
{
    public const MAX_ATTEMPTS = 5;

    public const TTL_MINUTES = 15;

    protected $guarded = ['id'];

    protected $casts = ['expires_at' => 'datetime', 'used_at' => 'datetime', 'attempts' => 'integer'];
}
