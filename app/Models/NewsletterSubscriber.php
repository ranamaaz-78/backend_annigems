<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsletterSubscriber extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['subscribed_at' => 'datetime', 'unsubscribed_at' => 'datetime'];
}
