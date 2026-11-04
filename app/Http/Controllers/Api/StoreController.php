<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\TestimonialResource;
use App\Models\Category;
use App\Models\Country;
use App\Models\OrderStage;
use App\Models\Product;
use App\Models\Setting;
use App\Models\ShippingMethod;
use App\Models\Testimonial;
use App\Services\CartQuoteService;
use App\Services\CurrencyService;
use App\Services\GoldRateService;
use App\Services\PricingService;
use App\Support\Content;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Store
 *
 * Public store data: bootstrap and home. Send `X-Currency` (EUR, USD, INR, AED, GBP) to get prices in that currency.
 *
 * @unauthenticated
 */
class StoreController extends Controller
{
    public function __construct(
        private CurrencyService $currency,
        private PricingService $pricing,
        private GoldRateService $gold,
    ) {}

    /**
     * Bootstrap
     *
     * Everything the app needs on start: brand, navigation, footer, contact, currencies (with rates), tax,
     * free-shipping threshold, shipping methods, countries, order stages, catalog filters, Stripe publishable key,
     * Google client id, gold rate. The mobile variant also returns `app` (versions, force update, maintenance).
     */
    public function bootstrap(Request $request): JsonResponse
    {
        $platform = $request->attributes->get('platform', 'web');
        $googleIds = config('services.google.client_ids');

        $data = [
            'brand' => Content::get('brand'),
            'navigation' => [
                'mega_menu' => Content::get('navigation.mega_menu'),
                'mobile' => Content::get('navigation.mobile', []),
            ],
            'footer' => [
                'columns' => Content::get('footer.columns', []),
                'legal_links' => Content::get('footer.legal_links', []),
            ],
            'contact' => Content::get('contact'),
            'contact_topics' => Content::get('contact.topics', []),
            'trust_points' => Content::get('trust_points', []),
            'payment_badges' => Content::get('payment_badges', []),
            'currencies' => $this->currency->summary(),
            'default_currency' => CurrencyService::BASE,
            'tax_rate' => (float) Setting::get('tax.rate', 0),
            'free_shipping_threshold' => $this->currency->money($this->pricing->freeShippingThreshold()),
            'shipping_methods' => ShippingMethod::where('is_active', true)->orderBy('sort_order')->get()->map(fn ($m) => [
                'code' => $m->code,
                'name' => $m->name,
                'delivery_time' => $m->delivery_time,
                'price' => $this->currency->moneyFromEur($m->price),
                'free_over_threshold' => $m->free_over_threshold,
            ]),
            'countries' => Country::where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(['code', 'name']),
            'order_stages' => OrderStage::orderBy('sort_order')->get()->map(fn ($s) => ['code' => $s->code, 'label' => $s->label, 'description' => $s->description]),
            'catalog' => [
                'sort_options' => Content::get('catalog.sort_options', []),
                'stone_filters' => Content::get('catalog.stone_filters', []),
                'max_price' => $this->currency->moneyFromEur((int) Content::get('catalog.max_price_filter', 0)),
                'badges' => Product::BADGES,
            ],
            'stripe_publishable_key' => config('services.stripe.key'),
            'stripe_mode' => str_starts_with((string) config('services.stripe.key'), 'pk_live') ? 'live' : 'test',
            'google_client_id' => $platform === 'mobile'
                ? ['ios' => $googleIds['ios'], 'android' => $googleIds['android'], 'web' => $googleIds['web']]
                : $googleIds['web'],
            'gold_rate' => app(CartQuoteService::class)->presentGold($this->gold->current()),
        ];

        if ($platform === 'mobile') {
            $mobile = Setting::get('app.mobile', []);
            $maintenance = Setting::get('app.maintenance', ['enabled' => false, 'message' => '']);
            $data['app'] = [
                'ios' => $mobile['ios'] ?? null,
                'android' => $mobile['android'] ?? null,
                'maintenance' => ['enabled' => (bool) ($maintenance['enabled'] ?? false), 'message' => $maintenance['message'] ?? ''],
            ];
        }

        return response()->json(['data' => $data]);
    }

    /**
     * Home
     *
     * Hero, USP items, categories with counts, featured products, new arrivals, design-ring banner, testimonials.
     */
    public function home(): JsonResponse
    {
        $with = ['images', 'category'];

        return response()->json(['data' => [
            'hero' => Content::get('home.hero'),
            'usp_items' => Content::get('home.usp_items', []),
            'category_section' => Content::get('home.category_section'),
            'categories' => CategoryResource::collection(static::categoriesQuery()->get()),
            'featured_products' => ProductResource::collection(Product::visible()->with($with)->where('is_featured', true)->orderBy('featured_sort')->orderBy('id')->get()),
            'new_arrivals' => ProductResource::collection(Product::visible()->with($with)->where('is_new_arrival', true)->orderBy('new_arrival_sort')->orderBy('id')->get()),
            'design_ring_banner' => Content::get('home.design_ring_banner'),
            'testimonials_section' => Content::get('home.testimonials_section'),
            'testimonials' => TestimonialResource::collection(Testimonial::where('is_active', true)->orderBy('sort_order')->get()),
        ]]);
    }

    public static function categoriesQuery()
    {
        return Category::active()->orderBy('sort_order')->orderBy('id')
            ->withCount(['products' => fn ($q) => $q->visible()]);
    }
}
