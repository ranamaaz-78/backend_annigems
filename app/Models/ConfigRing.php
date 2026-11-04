<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ConfigRing extends Model
{
    use LogsChanges, SoftDeletes;

    public const KARATS = [9, 10, 14, 18, 22, 24];

    protected $guarded = ['id'];

    protected $casts = [
        'karat' => 'integer',
        'gold_weight_g' => 'decimal:3',
        'craft_fee' => 'integer',
        'sizes' => 'array',
        'is_active' => 'boolean',
    ];

    public function combos(): HasMany
    {
        return $this->hasMany(ConfigRingStone::class, 'ring_id');
    }

    public function stones(): BelongsToMany
    {
        return $this->belongsToMany(ConfigStone::class, 'config_ring_stone', 'ring_id', 'stone_id')
            ->withPivot(['id', 'image', 'is_active'])->withTimestamps();
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
