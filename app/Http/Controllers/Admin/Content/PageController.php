<?php

namespace App\Http\Controllers\Admin\Content;

use App\Http\Controllers\Admin\CrudController;
use App\Models\Page;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** @group Admin: Content */
class PageController extends CrudController
{
    protected string $model = Page::class;

    protected array $searchable = ['title', 'slug'];

    protected array $sortable = ['id', 'title', 'slug', 'updated_at'];

    protected string $defaultSort = 'id';

    protected function rules(Request $request, ?Model $model = null): array
    {
        return [
            'slug' => ['required', 'alpha_dash', 'max:120', Rule::unique('pages', 'slug')->ignore($model?->id)],
            'title' => ['required', 'string', 'max:190'],
            'eyebrow' => ['nullable', 'string', 'max:120'],
            'intro' => ['nullable', 'string', 'max:2000'],
            'updated_label' => ['nullable', 'string', 'max:60'],
            'sections' => ['present', 'array'],
            'sections.*.id' => ['nullable', 'string', 'max:60'],
            'sections.*.heading' => ['required', 'string', 'max:190'],
            'sections.*.body' => ['present', 'array'],
            'sections.*.body.*' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['boolean'],
        ];
    }

    protected function messages(): array
    {
        return ['sections.*.heading.required' => 'Every section needs a heading.'];
    }

    protected function prepare(array $data, Request $request, ?Model $model = null): array
    {
        $data['sections'] = array_map(fn ($s) => [
            'id' => ($s['id'] ?? null) ?: Str::slug($s['heading']),
            'heading' => $s['heading'],
            'body' => array_values(array_filter($s['body'] ?? [], fn ($p) => $p !== null && trim($p) !== '')),
        ], array_values($data['sections']));

        return $data;
    }
}
