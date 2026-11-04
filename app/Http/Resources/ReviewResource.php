<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'location' => $this->location,
            'initials' => $this->initials,
            'rating' => $this->rating,
            'text' => $this->text,
            'is_generic' => $this->product_id === null,
        ];
    }
}
