<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;

class Testimonial extends Model
{
    use LogsChanges;

    protected string $activityLogName = 'content';

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean', 'rating' => 'integer'];
}
