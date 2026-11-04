<?php

namespace App\Http\Controllers\Admin\Configurator;

use App\Http\Controllers\Admin\CrudController;
use App\Models\ConfigRing;
use App\Models\ConfigRingStone;
use App\Models\ConfigStone;
use App\Services\PricingService;
use App\Support\Media;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** @group Admin: Design Your Ring */
class RingController extends CrudController
{
    protected string $model = ConfigRing::class;

    protected array $searchable = ['name', 'type', 'setting'];

    protected array $sortable = ['id', 'name', 'sort_order', 'karat', 'craft_fee'];

    protected string $defaultSort = 'sort_order';

    protected function rules(Request $request, ?Model $model = null): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'alpha_dash', 'max:120', Rule::unique('config_rings', 'slug')->ignore($model?->id)],
            'type' => ['nullable', 'string', 'max:120'],
            'setting' => ['nullable', 'string', 'max:120'],
            'karat' => ['required', 'integer', Rule::in(ConfigRing::KARATS)],
            'metal_color' => ['nullable', 'in:yellow,white,rose'],
            'gold_weight_g' => ['required', 'numeric', 'min:0.001', 'max:999'],
            'craft_fee' => ['required', 'integer', 'min:0'],
            'sizes' => ['required', 'array', 'min:1'],
            'sizes.*' => ['string', 'max:10'],
            'image' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'delivery_text' => ['nullable', 'string', 'max:60'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ];
    }

    protected function prepare(array $data, Request $request, ?Model $model = null): array
    {
        $data['slug'] = $data['slug'] ?? ($model?->slug ?: Str::slug($data['name']));
        $data['image'] = Media::normalize($data['image'] ?? null);
        $data['delivery_text'] = ($data['delivery_text'] ?? null) ?: '4-6 weeks';
        $data['sort_order'] ??= 0;
        // Keep sizes in numeric order.
        $data['sizes'] = collect($data['sizes'])->unique()->sortBy(fn ($s) => (float) $s)->values()->all();

        return $data;
    }

    protected function afterSave(Model $model, array $data, Request $request): void
    {
        // New rings get an (inactive) combo row for every stone so the matrix is complete.
        foreach (ConfigStone::pluck('id') as $stoneId) {
            ConfigRingStone::firstOrCreate(['ring_id' => $model->id, 'stone_id' => $stoneId], ['is_active' => false]);
        }
    }

    protected function transform(Model $r): array
    {
        $p = app(PricingService::class)->configuratorPriceEur($r);

        return $r->toArray() + ['image_url' => Media::url($r->image), 'gold_value' => $p['gold_value'], 'ring_charge' => $p['ring_charge']];
    }
}
