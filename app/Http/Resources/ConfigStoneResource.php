<?php

namespace App\Http\Resources;

use App\Models\ConfigStone;
use App\Services\CurrencyService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ConfigStone */
class ConfigStoneResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'origin' => $this->origin,
            'price' => app(CurrencyService::class)->moneyFromEur($this->price),
            'rarity' => $this->rarity,
            'carat' => $this->carat !== null ? (float) $this->carat : null,
            'color' => $this->color,
            'glow' => $this->glow,
            'gem_style' => $this->gem_style,
            'uses_diamond_animation' => $this->uses_diamond_animation,
            'description' => $this->description,
        ];
    }
}
