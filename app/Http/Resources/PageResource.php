<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'title' => $this->title,
            'eyebrow' => $this->eyebrow,
            'intro' => $this->intro,
            'updated' => $this->updated_label,
            'sections' => $this->sections ?? [],
        ];
    }
}
