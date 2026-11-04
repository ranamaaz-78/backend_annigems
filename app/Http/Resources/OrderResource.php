<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Services\CurrencyService;
use App\Services\OrderService;
use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Order */
class OrderResource extends JsonResource
{
    public bool $full = false;

    public function full(): static
    {
        $this->full = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $fx = app(CurrencyService::class);
        $m = fn ($v) => $fx->money((int) $v, $this->currency);

        $base = [
            'number' => $this->order_number,
            'status' => $this->status,
            'stage' => $this->stage,
            'placed_from' => $this->placed_from,
            'currency' => $this->currency,
            'total' => $m($this->total),
            'items_count' => (int) ($this->items_count ?? $this->items->sum('qty')),
            'first_item' => $this->whenLoaded('items', fn () => $this->items->first() ? [
                'name' => $this->items->first()->name,
                'image' => Media::url($this->items->first()->image),
            ] : null),
            'can_pay' => $this->isPayable(),
            'can_cancel' => $this->isPayable(),
            'created_at' => $this->created_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
        ];
        if (! $this->full) {
            return $base;
        }

        return $base + [
            'email' => $this->email,
            'items' => $this->items->map(fn ($i) => [
                'id' => $i->id,
                'kind' => $i->kind,
                'product_id' => $i->product_id,
                'product_slug' => $i->snapshot['slug'] ?? null,
                'legacy_id' => $i->snapshot['legacy_id'] ?? null,
                'ring_id' => $i->config_ring_id,
                'stone_id' => $i->config_stone_id,
                'name' => $i->name,
                'subtitle' => $i->subtitle,
                'image' => Media::url($i->image),
                'size' => $i->size,
                'qty' => $i->qty,
                'unit_price' => $m($i->unit_price),
                'line_total' => $m($i->line_total),
                'custom_ring' => $i->kind === 'custom_ring' ? [
                    'ring_name' => $i->snapshot['ring_name'] ?? null,
                    'setting' => $i->snapshot['setting'] ?? null,
                    'karat' => $i->snapshot['karat'] ?? null,
                    'metal_color' => $i->snapshot['metal_color'] ?? null,
                    'gold_weight_g' => $i->snapshot['gold_weight_g'] ?? null,
                    'stone_name' => $i->snapshot['stone_name'] ?? null,
                    'delivery_text' => $i->snapshot['delivery_text'] ?? null,
                ] : null,
            ])->values(),
            'totals' => [
                'subtotal' => $m($this->subtotal),
                'discount' => $m($this->discount),
                'shipping' => $m($this->shipping),
                'tax_rate' => $this->tax_rate,
                'tax' => $m($this->tax),
                'total' => $m($this->total),
                'refunded' => $m($this->refunded_amount),
            ],
            'coupon_code' => $this->coupon_code,
            'shipping_method' => [
                'code' => $this->shipping_method_code,
                'name' => $this->shipping_method_name,
                'delivery_time' => $this->shipping_delivery_time,
            ],
            'shipping_address' => [
                'name' => $this->ship_name,
                'phone' => $this->ship_phone,
                'line1' => $this->ship_line1,
                'city' => $this->ship_city,
                'state' => $this->ship_state,
                'zip' => $this->ship_zip,
                'country' => $this->ship_country,
                'country_code' => $this->ship_country_code,
            ],
            'tracking' => [
                'carrier' => $this->carrier,
                'number' => $this->tracking_number,
                'url' => $this->tracking_url,
                'shipped_at' => $this->shipped_at?->toIso8601String(),
                'delivered_at' => $this->delivered_at?->toIso8601String(),
            ],
            'timeline' => app(OrderService::class)->timeline($this->resource),
            'history' => $this->history->map(fn ($h) => [
                'field' => $h->field,
                'from' => $h->from,
                'to' => $h->to,
                'at' => $h->created_at->toIso8601String(),
            ])->values(),
            'customer_note' => $this->customer_note,
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
        ];
    }
}
