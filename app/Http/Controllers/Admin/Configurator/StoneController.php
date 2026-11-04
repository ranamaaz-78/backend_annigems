<?php

namespace App\Http\Controllers\Admin\Configurator;

use App\Http\Controllers\Admin\CrudController;
use App\Models\ConfigRing;
use App\Models\ConfigRingStone;
use App\Models\ConfigStone;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** @group Admin: Design Your Ring */
class StoneController extends CrudController
{
    protected string $model = ConfigStone::class;

    protected array $searchable = ['name', 'origin', 'rarity'];

    protected array $sortable = ['id', 'name', 'price', 'sort_order'];

    protected string $defaultSort = 'sort_order';

    protected function rules(Request $request, ?Model $model = null): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'alpha_dash', 'max:120', Rule::unique('config_stones', 'slug')->ignore($model?->id)],
            'origin' => ['nullable', 'string', 'max:120'],
            'price' => ['required', 'integer', 'min:0'],
            'rarity' => ['nullable', 'string', 'max:40'],
            'carat' => ['nullable', 'numeric', 'min:0', 'max:999'],
            'color' => ['nullable', 'string', 'max:20'],
            'glow' => ['nullable', 'string', 'max:60'],
            'gem_style' => ['nullable', 'string', 'max:500'],
            'uses_diamond_animation' => ['boolean'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ];
    }

    protected function prepare(array $data, Request $request, ?Model $model = null): array
    {
        $data['slug'] = $data['slug'] ?? ($model?->slug ?: Str::slug($data['name']));
        $data['sort_order'] ??= 0;

        return $data;
    }

    protected function afterSave(Model $model, array $data, Request $request): void
    {
        foreach (ConfigRing::pluck('id') as $ringId) {
            ConfigRingStone::firstOrCreate(['ring_id' => $ringId, 'stone_id' => $model->id], ['is_active' => false]);
        }
    }
}
