<?php

namespace App\Http\Resources;

use App\Models\ConfigRing;
use App\Services\CurrencyService;
use App\Services\PricingService;
use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ConfigRing */
class ConfigRingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $price = app(PricingService::class)->configuratorPrice($this->resource);
        $money = app(CurrencyService::class);

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'type' => $this->type,
            'setting' => $this->setting,
            'karat' => $this->karat,
            'metal' => $this->karat.'K Gold',
            'metal_color' => $this->metal_color,
            'gold_weight_g' => (float) $this->gold_weight_g,
            'sizes' => array_values($this->sizes ?? []),
            'image' => Media::url($this->image),
            'description' => $this->description,
            'delivery_text' => $this->delivery_text,
            'gold_value' => $money->money($price['gold_value']),
            'craft_fee' => $money->money($price['craft_fee']),
            'ring_charge' => $money->money($price['ring_charge']),
        ];
    }
}
