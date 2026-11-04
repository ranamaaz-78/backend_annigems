<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;

class Page extends Model
{
    use LogsChanges;

    protected string $activityLogName = 'content';

    protected $guarded = ['id'];

    protected $casts = ['sections' => 'array', 'is_active' => 'boolean'];
}
