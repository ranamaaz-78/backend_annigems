<?php

namespace App\Http\Resources;

use App\Models\Address;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Address */
class AddressResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'name' => $this->name,
            'phone' => $this->phone,
            'line1' => $this->line1,
            'city' => $this->city,
            'state' => $this->state,
            'zip' => $this->zip,
            'country_code' => $this->country_code,
            'country' => $this->country?->name,
            'is_default' => $this->is_default,
        ];
    }
}
