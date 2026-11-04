<?php

namespace App\Http\Controllers\Admin\Configurator;

use App\Http\Controllers\Controller;
use App\Models\ConfigRing;
use App\Models\ConfigRingStone;
use App\Models\ConfigStone;
use App\Services\CurrencyService;
use App\Services\GoldRateService;
use App\Services\PricingService;
use App\Support\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** @group Admin: Design Your Ring */
class ComboController extends Controller
{
    /** Rings × stones matrix. */
    public function index(): JsonResponse
    {
        $rings = ConfigRing::orderBy('sort_order')->orderBy('id')->get();
        $stones = ConfigStone::orderBy('sort_order')->orderBy('id')->get();
        $combos = ConfigRingStone::all()->keyBy(fn ($c) => $c->ring_id.':'.$c->stone_id);

        return response()->json(['data' => [
            'rings' => $rings->map(fn ($r) => ['id' => $r->id, 'name' => $r->name, 'is_active' => $r->is_active, 'image_url' => Media::url($r->image)]),
            'stones' => $stones->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'is_active' => $s->is_active, 'color' => $s->color]),
            'combos' => $combos->values()->map(fn ($c) => [
                'ring_id' => $c->ring_id, 'stone_id' => $c->stone_id, 'is_active' => $c->is_active,
                'image' => $c->image, 'image_url' => Media::url($c->image),
            ]),
        ]]);
    }

    /** Create or update one combo: toggle active and/or set its image. */
    public function upsert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ring_id' => ['required', 'integer', 'exists:config_rings,id'],
            'stone_id' => ['required', 'integer', 'exists:config_stones,id'],
            'is_active' => ['sometimes', 'boolean'],
            'image' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);
        $combo = ConfigRingStone::firstOrNew(['ring_id' => $data['ring_id'], 'stone_id' => $data['stone_id']]);
        if (array_key_exists('is_active', $data)) {
            $combo->is_active = $data['is_active'];
        }
        if (array_key_exists('image', $data)) {
            $combo->image = Media::normalize($data['image']);
        }
        $combo->is_active ??= false;
        $combo->save();

        return response()->json(['data' => [
            'ring_id' => $combo->ring_id, 'stone_id' => $combo->stone_id, 'is_active' => $combo->is_active,
            'image' => $combo->image, 'image_url' => Media::url($combo->image),
        ]]);
    }

    /** Price preview: breakdown with the current gold rate in EUR and every active currency. */
    public function preview(Request $request, PricingService $pricing, CurrencyService $fx, GoldRateService $gold): JsonResponse
    {
        $data = $request->validate(['ring_id' => ['required', 'integer'], 'stone_id' => ['nullable', 'integer']]);
        $ring = ConfigRing::findOrFail($data['ring_id']);
        $stone = isset($data['stone_id']) ? ConfigStone::findOrFail($data['stone_id']) : null;
        $eur = $pricing->configuratorPriceEur($ring, $stone);
        $currencies = $fx->active()->keys()->map(function ($code) use ($pricing, $ring, $stone, $fx) {
            $p = $pricing->configuratorPrice($ring, $stone, $code);

            return [
                'currency' => $code,
                'rate' => $fx->rate($code),
                'gold_value' => $fx->money($p['gold_value'], $code),
                'craft_fee' => $fx->money($p['craft_fee'], $code),
                'ring_charge' => $fx->money($p['ring_charge'], $code),
                'stone_price' => $fx->money($p['stone_price'], $code),
                'total' => $fx->money($p['total'], $code),
            ];
        })->values();

        return response()->json(['data' => [
            'eur' => $eur,
            'gold' => $gold->current()['source'],
            'gold_updated_at' => $gold->current()['updated_at']?->toIso8601String(),
            'currencies' => $currencies,
        ]]);
    }
}
