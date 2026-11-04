<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ConfigRingResource;
use App\Http\Resources\ConfigStoneResource;
use App\Models\ConfigRing;
use App\Models\ConfigRingStone;
use App\Models\ConfigStone;
use App\Services\CartQuoteService;
use App\Services\CurrencyService;
use App\Services\GoldRateService;
use App\Services\PricingService;
use App\Support\Content;
use App\Support\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * @group Design Your Ring
 *
 * Flow: choose ring → choose size → choose stone → preview → add to cart. Metal and karat come with the ring.
 *
 * @unauthenticated
 */
class ConfiguratorController extends Controller
{
    public function __construct(
        private PricingService $pricing,
        private CurrencyService $currency,
        private GoldRateService $gold,
    ) {}

    /**
     * Configurator data
     *
     * Steps, active rings (sizes, karat, ring charge in the request currency), active stones,
     * active combos with images, size chart, guide steps, gold rate.
     */
    public function show(): JsonResponse
    {
        $rings = ConfigRing::active()->orderBy('sort_order')->orderBy('id')->get();
        $stones = ConfigStone::active()->orderBy('sort_order')->orderBy('id')->get();
        $combos = ConfigRingStone::with('ring')->where('is_active', true)
            ->whereIn('ring_id', $rings->pluck('id'))->whereIn('stone_id', $stones->pluck('id'))->get();

        return response()->json(['data' => [
            'steps' => Content::get('configurator.steps', []),
            'rings' => ConfigRingResource::collection($rings),
            'stones' => ConfigStoneResource::collection($stones),
            'combos' => $combos->map(fn (ConfigRingStone $c) => [
                'ring_id' => $c->ring_id,
                'stone_id' => $c->stone_id,
                'image' => Media::url($c->imageOrRing()),
            ])->values(),
            'size_chart' => Content::get('configurator.size_chart', []),
            'size_guide_steps' => Content::get('configurator.size_guide_steps', []),
            'gold_rate' => app(CartQuoteService::class)->presentGold($this->gold->current()),
        ]]);
    }

    /**
     * Price a ring + stone
     *
     * Full breakdown: gold value, craft fee, ring charge, stone price, total and the gold rate used.
     * Ring size does not change the price; it is only validated.
     *
     * @bodyParam ring_id integer required Example: 1
     * @bodyParam stone_id integer required Example: 1
     * @bodyParam size string required US ring size. Example: 6.5
     */
    public function price(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ring_id' => ['required', 'integer'],
            'stone_id' => ['required', 'integer'],
            'size' => ['required'],
        ], [
            'ring_id.required' => 'Please choose a ring.',
            'stone_id.required' => 'Please choose a stone.',
            'size.required' => 'Please choose your ring size.',
        ]);

        $combo = ConfigRingStone::with(['ring', 'stone'])->where('ring_id', $data['ring_id'])->where('stone_id', $data['stone_id'])->first();
        if (! $combo || ! $combo->isAvailable()) {
            throw ValidationException::withMessages(['stone_id' => 'This stone is not available for the selected ring.']);
        }
        $ring = $combo->ring;
        if (! in_array((string) $data['size'], array_map('strval', $ring->sizes ?? []), true)) {
            throw ValidationException::withMessages(['size' => 'This size is not available for the selected ring.']);
        }

        $p = $this->pricing->configuratorPrice($ring, $combo->stone);
        $m = fn ($v) => $this->currency->money($v);

        return response()->json(['data' => [
            'ring' => new ConfigRingResource($ring),
            'stone' => new ConfigStoneResource($combo->stone),
            'size' => (string) $data['size'],
            'image' => Media::url($combo->imageOrRing()),
            'karat' => $ring->karat,
            'purity' => $p['eur']['purity'],
            'gold_weight_g' => $p['eur']['gold_weight_g'],
            'gold_value' => $m($p['gold_value']),
            'craft_fee' => $m($p['craft_fee']),
            'ring_charge' => $m($p['ring_charge']),
            'stone_price' => $m($p['stone_price']),
            'total' => $m($p['total']),
            'total_eur' => $this->currency->money($p['eur']['total'], 'EUR'),
            'delivery_text' => $ring->delivery_text,
            'gold_rate' => app(CartQuoteService::class)->presentGold($this->gold->current()),
        ]]);
    }
}
