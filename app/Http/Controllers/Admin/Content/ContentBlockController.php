<?php

namespace App\Http\Controllers\Admin\Content;

use App\Http\Controllers\Controller;
use App\Models\ContentBlock;
use App\Support\Content;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * @group Admin: Content
 *
 * Content blocks have a fixed set of keys (seeded from the storefront). The admin UI renders a structured form per key.
 */
class ContentBlockController extends Controller
{
    /** Keys and the shape each value must have ('object' | 'list' | 'scalar'). */
    public const KEYS = [
        'brand' => ['Brand', 'object'],
        'home.hero' => ['Home: hero', 'object'],
        'home.usp_items' => ['Home: USP items', 'list'],
        'home.category_section' => ['Home: category section', 'object'],
        'home.design_ring_banner' => ['Home: Design-Your-Ring banner', 'object'],
        'home.testimonials_section' => ['Home: testimonials section', 'object'],
        'navigation.mega_menu' => ['Navigation: mega menu', 'object'],
        'navigation.mobile' => ['Navigation: mobile menu', 'list'],
        'footer.columns' => ['Footer: columns', 'list'],
        'footer.legal_links' => ['Footer: legal links', 'list'],
        'contact' => ['Contact details', 'object'],
        'contact.topics' => ['Contact topics', 'list'],
        'trust_points' => ['Trust points', 'list'],
        'payment_badges' => ['Payment badges', 'list'],
        'product.shipping_points' => ['Product page: shipping points', 'list'],
        'product.care_instructions' => ['Product page: care instructions', 'list'],
        'about' => ['About page', 'object'],
        'services' => ['Services', 'list'],
        'configurator.steps' => ['Configurator: step labels', 'list'],
        'configurator.size_chart' => ['Configurator: size chart', 'list'],
        'configurator.size_guide_steps' => ['Configurator: size guide steps', 'list'],
        'catalog.sort_options' => ['Catalog: sort options', 'list'],
        'catalog.stone_filters' => ['Catalog: stone filters', 'list'],
        'catalog.max_price_filter' => ['Catalog: max price filter (EUR minor)', 'scalar'],
        'catalog.rating_distribution' => ['Catalog: rating distribution', 'list'],
    ];

    public function index(): JsonResponse
    {
        $blocks = ContentBlock::with('updatedBy:id,name')->get()->keyBy('key');

        return response()->json(['data' => collect(self::KEYS)->map(fn ($meta, $key) => [
            'key' => $key,
            'label' => $meta[0],
            'shape' => $meta[1],
            'value' => $blocks[$key]->value ?? null,
            'updated_at' => $blocks[$key]?->updated_at?->toIso8601String(),
            'updated_by' => $blocks[$key]?->updatedBy?->name,
        ])->values()]);
    }

    public function show(string $key): JsonResponse
    {
        abort_unless(isset(self::KEYS[$key]), 404, 'Unknown content block.');
        $block = ContentBlock::where('key', $key)->first();

        return response()->json(['data' => [
            'key' => $key, 'label' => self::KEYS[$key][0], 'shape' => self::KEYS[$key][1],
            'value' => $block?->value, 'preview' => Content::present($block?->value),
        ]]);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        abort_unless(isset(self::KEYS[$key]), 404, 'Unknown content block.');
        $request->validate(['value' => ['present']]);
        $value = $request->input('value');
        $shape = self::KEYS[$key][1];
        $ok = match ($shape) {
            'list' => is_array($value) && array_is_list($value),
            'object' => is_array($value) && ($value === [] || ! array_is_list($value)),
            default => is_scalar($value),
        };
        if (! $ok) {
            throw ValidationException::withMessages(['value' => "This block must be a {$shape}."]);
        }
        if ($key === 'catalog.max_price_filter') {
            $value = (int) $value;
        }

        $block = ContentBlock::updateOrCreate(['key' => $key], ['value' => $this->normalize($value), 'updated_by' => $request->user('admin')->id]);

        return response()->json(['data' => ['key' => $key, 'value' => $block->value], 'message' => 'Content saved.']);
    }

    /** Uploaded image URLs → disk paths; trim strings. */
    private function normalize(mixed $v): mixed
    {
        if (is_array($v)) {
            return array_map(fn ($x) => $this->normalize($x), $v);
        }
        if (is_string($v)) {
            $v = trim($v);
            $appHost = parse_url((string) config('app.url'), PHP_URL_HOST);
            if (preg_match('#^(?:https?://([^/]+))?/storage/(.+)$#', $v, $m) && (! $m[1] || $m[1] === $appHost || str_starts_with($m[1], $appHost.':'))) {
                return $m[2];
            }

            return $v;
        }

        return $v;
    }
}
