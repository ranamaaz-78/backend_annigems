<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ConfigStone extends Model
{
    use LogsChanges, SoftDeletes;

    protected $guarded = ['id'];

    protected $casts = [
        'price' => 'integer',
        'carat' => 'decimal:2',
        'uses_diamond_animation' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function combos(): HasMany
    {
        return $this->hasMany(ConfigRingStone::class, 'stone_id');
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
