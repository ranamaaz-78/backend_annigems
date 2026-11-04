<?php

namespace App\Http\Requests;

/** Shared validation for cart lines (quote and checkout). Prices are never accepted. */
class CartItemsRules
{
    public static function rules(bool $allowEmpty = false): array
    {
        return [
            'items' => [$allowEmpty ? 'present' : 'required', 'array', 'max:50'],
            'items.*.type' => ['required', 'in:product,custom_ring'],
            'items.*.product_id' => ['required_if:items.*.type,product', 'nullable', 'integer'],
            'items.*.ring_id' => ['required_if:items.*.type,custom_ring', 'nullable', 'integer'],
            'items.*.stone_id' => ['required_if:items.*.type,custom_ring', 'nullable', 'integer'],
            'items.*.size' => ['nullable', 'string', 'max:10'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:10'],
        ];
    }

    public static function messages(): array
    {
        return [
            'items.required' => 'Your bag is empty.',
            'items.*.type.in' => 'Unknown item type.',
            'items.*.qty.max' => 'You can order up to 10 of each item.',
            'items.*.qty.min' => 'Quantity must be at least 1.',
            'items.*.product_id.required_if' => 'Product is missing.',
            'items.*.ring_id.required_if' => 'Please choose a ring.',
            'items.*.stone_id.required_if' => 'Please choose a stone.',
        ];
    }
}
