<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;

class Country extends Model
{
    use LogsChanges;

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean'];
}
