<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $guarded = ['id'];

    protected $casts = [
        'qty' => 'integer',
        'unit_price' => 'integer',
        'line_total' => 'integer',
        'unit_price_eur' => 'integer',
        'snapshot' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function ring(): BelongsTo
    {
        return $this->belongsTo(ConfigRing::class, 'config_ring_id')->withTrashed();
    }

    public function stone(): BelongsTo
    {
        return $this->belongsTo(ConfigStone::class, 'config_stone_id')->withTrashed();
    }
}
