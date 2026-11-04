<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Ring × stone combo: a stone is offered for a ring only through an active combo. */
class ConfigRingStone extends Model
{
    use LogsChanges;

    protected $table = 'config_ring_stone';

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean'];

    public function ring(): BelongsTo
    {
        return $this->belongsTo(ConfigRing::class, 'ring_id');
    }

    public function stone(): BelongsTo
    {
        return $this->belongsTo(ConfigStone::class, 'stone_id');
    }

    /** The combo is offered: combo, ring and stone all active. */
    public function isAvailable(): bool
    {
        return $this->is_active && $this->ring && $this->ring->is_active && $this->stone && $this->stone->is_active;
    }

    public function imageOrRing(): ?string
    {
        return $this->image ?: $this->ring?->image;
    }
}
