<?php

namespace App\Http\Controllers\Admin\Pricing;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** @group Admin: Pricing */
class CommerceSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->values()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tax_rate' => ['required', 'numeric', 'min:0', 'max:1'],
            'free_shipping_threshold' => ['required', 'integer', 'min:0'],
            'pending_ttl_hours' => ['required', 'integer', 'min:1', 'max:720'],
        ], ['tax_rate.max' => 'Enter the tax rate as a fraction (0.08 = 8%).']);
        Setting::put('tax.rate', (float) $data['tax_rate']);
        Setting::put('shipping.free_threshold', (int) $data['free_shipping_threshold']);
        Setting::put('orders.pending_ttl_hours', (int) $data['pending_ttl_hours']);

        return response()->json(['data' => $this->values(), 'message' => 'Saved.']);
    }

    private function values(): array
    {
        return [
            'tax_rate' => (float) Setting::get('tax.rate', 0),
            'free_shipping_threshold' => (int) Setting::get('shipping.free_threshold', 0),
            'pending_ttl_hours' => (int) Setting::get('orders.pending_ttl_hours', 24),
        ];
    }
}
