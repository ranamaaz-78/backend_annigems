<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'avatar_url' => $this->avatar_url,
            'preferred_currency' => $this->preferred_currency,
            'account_type' => $this->account_type,
            'business' => $this->when($this->isBusiness(), function () {
                $p = $this->businessProfile()->with(['tier:id,name', 'salesRep:id,name,email'])->first();

                return $p ? [
                    'company_name' => $p->company_name,
                    'business_type' => $p->business_type,
                    'tax_id' => $p->tax_id,
                    'tier' => $p->tier?->name,
                    'sales_person' => $p->salesRep ? ['name' => $p->salesRep->name, 'email' => $p->salesRep->email] : null,
                ] : null;
            }),
            'has_password' => $this->hasPassword(),
            'google_linked' => $this->google_id !== null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
