<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\ConfigRing;
use App\Models\ConfigRingStone;
use App\Models\ConfigStone;
use App\Models\ContentBlock;
use App\Models\Country;
use App\Models\Coupon;
use App\Models\Faq;
use App\Models\FaqCategory;
use App\Models\OrderStage;
use App\Models\Page;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\Setting;
use App\Models\ShippingMethod;
use App\Models\Testimonial;
use App\Support\Media;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Seeds every piece of storefront content and catalog data from
 * database/seeders/data/storefront-seed.json. Money values in the file are
 * EUR major units; the database stores EUR minor units (cents).
 */
class StorefrontSeeder extends Seeder
{
    private array $d;

    public function run(): void
    {
        $path = database_path('seeders/data/storefront-seed.json');
        $this->d = json_decode(File::get($path), true, flags: JSON_THROW_ON_ERROR);

        $this->copyImages();
        $this->settings();
        $this->contentBlocks();
        $categories = $this->categories();
        $this->products($categories);
        $this->reviews();
        $this->configurator();
        $this->commerce();
        $this->orderStages();
        $this->pages();
        $this->faqs();
        $this->testimonials();
    }

    private static function cents(int|float|null $eur): ?int
    {
        return $eur === null ? null : (int) round($eur * 100);
    }

    /** Remove helper keys such as "_note" and normalise image paths recursively. */
    private static function clean(mixed $value): mixed
    {
        if (! is_array($value)) {
            return is_string($value) && str_starts_with($value, '/images/') ? Media::normalize($value) : $value;
        }
        $out = [];
        foreach ($value as $k => $v) {
            if (is_string($k) && str_starts_with($k, '_')) {
                continue;
            }
            $out[$k] = self::clean($v);
        }

        return $out;
    }

    private function copyImages(): void
    {
        $src = database_path('seeders/data/images');
        if (! is_dir($src)) {
            throw new RuntimeException("Seed images folder missing: {$src}");
        }
        $disk = Storage::disk('public');
        foreach (File::files($src) as $file) {
            $target = 'images/'.$file->getFilename();
            if (! $disk->exists($target) || $disk->size($target) !== $file->getSize()) {
                $disk->put($target, File::get($file->getPathname()));
            }
        }
    }

    private function settings(): void
    {
        $c = $this->d['commerce'];
        $defaults = [
            'tax.rate' => (float) $c['taxRate'],
            'shipping.free_threshold' => self::cents($c['freeShippingThreshold']),
            'gold.source' => 'manual',
            'gold.manual_rate_per_oz' => self::cents($this->d['goldRate']['perOz']),
            'gold.api_provider' => 'goldapi',
            'gold.fetch_interval_minutes' => 60,
            'fx.source' => 'manual',
            'fx.fetch_interval_minutes' => 720,
            'orders.pending_ttl_hours' => 24,
            'catalog.default_ring_sizes' => $this->d['catalog']['ringSizes'],
            'app.store_name' => $this->d['brand']['name'],
            'app.support_email' => $this->d['contact']['email'],
            'app.notify_email' => env('MAIL_ADMIN_NOTIFY', $this->d['contact']['email']),
            'app.mobile' => [
                'ios' => ['min_version' => '1.0.0', 'latest_version' => '1.0.0', 'force_update' => false],
                'android' => ['min_version' => '1.0.0', 'latest_version' => '1.0.0', 'force_update' => false],
            ],
            'app.maintenance' => ['enabled' => false, 'message' => ''],
        ];
        foreach ($defaults as $key => $value) {
            Setting::firstOrCreate(['key' => $key], ['value' => $value]);
        }
        Setting::flush();
    }

    private function block(string $key, mixed $value): void
    {
        ContentBlock::updateOrCreate(['key' => $key], ['value' => self::clean($value)]);
    }

    private function contentBlocks(): void
    {
        $d = $this->d;
        $home = $d['home'];

        $this->block('brand', $d['brand']);
        $this->block('home.hero', $home['hero']);
        $this->block('home.usp_items', $home['uspItems']);
        $this->block('home.category_section', $home['categorySection']);
        $this->block('home.design_ring_banner', $home['designRingBanner']);
        $this->block('home.testimonials_section', $home['testimonialsSection']);
        $this->block('navigation.mega_menu', $d['navigation']['megaMenu']);
        $this->block('navigation.mobile', $d['navigation']['mobileNav']);
        $this->block('footer.columns', $d['navigation']['footerColumns']);
        $this->block('footer.legal_links', $d['navigation']['footerLegalLinks']);

        $contact = $d['contact'];
        $this->block('contact', [
            'address' => $contact['address'],
            'phone' => $contact['phone'],
            'email' => $contact['email'],
            'hours' => $contact['hours'],
            'whatsapp' => $contact['whatsapp'],
            'map_embed_url' => $contact['mapSrc'],
        ]);
        $this->block('contact.topics', ['Order enquiry', 'Custom / bespoke ring', 'Repairs & resizing', 'Gold & gemstone advice', 'Other']);

        $this->block('trust_points', $d['trustPoints']);
        // Stripe card brands only (brief §3.10).
        $this->block('payment_badges', ['VISA', 'MC', 'AMEX']);
        $this->block('product.shipping_points', $d['productPageShippingPoints']);
        $this->block('product.care_instructions', $d['careInstructions']);
        $this->block('about', $d['about']);
        $this->block('services', $d['services']);

        $cfg = $d['configurator'];
        $this->block('configurator.steps', $cfg['steps']);
        $this->block('configurator.size_chart', $cfg['sizeChart']);
        $this->block('configurator.size_guide_steps', $cfg['sizeGuideSteps']);

        $cat = $d['catalog'];
        $this->block('catalog.sort_options', $cat['sortOptions']);
        $this->block('catalog.stone_filters', $cat['stoneFilters']);
        $this->block('catalog.max_price_filter', self::cents($cat['maxPriceFilter']));
        $this->block('catalog.rating_distribution', $cat['ratingDistribution']);
    }

    /** @return array<string,int> slug => id */
    private function categories(): array
    {
        $map = [];
        foreach ($this->d['catalog']['categories'] as $i => $c) {
            $cat = Category::withTrashed()->updateOrCreate(['slug' => $c['id']], [
                'name' => $c['label'],
                'image' => Media::normalize($c['image']),
                'sort_order' => $i + 1,
                'is_active' => true,
            ]);
            $map[$c['id']] = $cat->id;
        }

        return $map;
    }

    private function products(array $categories): void
    {
        $featured = $this->d['home']['featuredProductIds'];
        $newArrivals = $this->d['home']['newArrivalProductIds'];
        $ringSizes = $this->d['catalog']['ringSizes'];

        foreach ($this->d['catalog']['products'] as $i => $p) {
            $isRing = $p['category'] === 'rings';
            $product = Product::withTrashed()->updateOrCreate(['legacy_id' => $p['id']], [
                'category_id' => $categories[$p['category']],
                'slug' => Str::slug($p['name']),
                'name' => $p['name'],
                'subtitle' => $p['subtitle'],
                'description' => $p['description'],
                'price' => self::cents($p['price']),
                'compare_at_price' => self::cents($p['originalPrice']),
                'badge' => $p['badge'],
                'metal' => $p['metal'],
                'stone' => $p['stone'],
                'weight' => $p['weight'],
                'details' => $p['details'],
                'tags' => $p['tags'],
                'rating' => $p['rating'],
                'reviews_count' => $p['reviews'],
                'has_sizes' => $isRing,
                'sizes' => $isRing ? $ringSizes : null,
                // The storefront only has an inStock flag; seed a small working stock.
                'stock_qty' => $p['inStock'] ? 10 : 0,
                'track_stock' => true,
                'is_customizable' => (bool) $p['customizable'],
                'is_featured' => in_array($p['id'], $featured, true),
                'featured_sort' => (int) array_search($p['id'], $featured, true),
                'is_new_arrival' => in_array($p['id'], $newArrivals, true),
                'new_arrival_sort' => (int) array_search($p['id'], $newArrivals, true),
                'is_active' => true,
                'published_at' => now()->subMinutes(count($this->d['catalog']['products']) - $i),
            ]);

            $product->images()->delete();
            $gallery = $p['gallery'] ?: [$p['image']];
            if ($gallery[0] !== $p['image']) {
                array_unshift($gallery, $p['image']);
            }
            foreach (array_values(array_unique($gallery)) as $j => $img) {
                $product->images()->create(['path' => Media::normalize($img), 'alt' => $p['name'], 'sort_order' => $j]);
            }
        }
    }

    private function reviews(): void
    {
        foreach ($this->d['productReviews'] as $i => $r) {
            ProductReview::updateOrCreate(['product_id' => null, 'name' => $r['name']], [
                'location' => $r['location'],
                'initials' => $r['initials'],
                'rating' => $r['rating'] ?? 5,
                'text' => $r['text'],
                'is_active' => true,
                'sort_order' => $i + 1,
            ]);
        }
    }

    private function configurator(): void
    {
        $cfg = $this->d['configurator'];
        $ringIds = [];
        foreach ($cfg['rings'] as $i => $r) {
            $ring = ConfigRing::withTrashed()->updateOrCreate(['slug' => Str::slug($r['name'])], [
                'name' => $r['name'],
                'type' => $r['type'],
                'setting' => $r['setting'],
                'karat' => 18, // brief §8: seed rings are 18K
                'metal_color' => 'yellow',
                'gold_weight_g' => $r['goldWeightG'],
                'craft_fee' => self::cents($r['craftFee']),
                'sizes' => $cfg['sizes'], // all sizes (4–12 in half sizes)
                'image' => Media::normalize($r['image']),
                'description' => $r['description'],
                'delivery_text' => '4-6 weeks',
                'sort_order' => $i + 1,
                'is_active' => true,
            ]);
            $ringIds[(string) $r['id']] = $ring->id;
        }

        foreach ($cfg['stones'] as $i => $s) {
            preg_match('/(\d+(?:\.\d+)?)\s*carat/i', $s['description'] ?? '', $m);
            $stone = ConfigStone::withTrashed()->updateOrCreate(['slug' => $s['id']], [
                'name' => $s['name'],
                'origin' => $s['origin'],
                'price' => self::cents($s['gemPrice']),
                'rarity' => $s['rarity'],
                'carat' => isset($m[1]) ? (float) $m[1] : null,
                'color' => $s['color'],
                'glow' => $s['glow'],
                'gem_style' => $s['gem'],
                'uses_diamond_animation' => $s['gem'] === null,
                'description' => $s['description'],
                'sort_order' => $i + 1,
                'is_active' => true,
            ]);

            // A combo for every ring × stone, image from the stone's {ringId: path} map.
            foreach ($ringIds as $seedRingId => $ringId) {
                ConfigRingStone::updateOrCreate(['ring_id' => $ringId, 'stone_id' => $stone->id], [
                    'image' => Media::normalize(Arr::get($s['images'] ?? [], $seedRingId)),
                    'is_active' => true,
                ]);
            }
        }
    }

    private function commerce(): void
    {
        $c = $this->d['commerce'];
        foreach ($c['shippingMethods'] as $i => $m) {
            ShippingMethod::updateOrCreate(['code' => $m['id']], [
                'name' => $m['name'],
                'delivery_time' => $m['time'],
                'price' => self::cents($m['price']),
                'free_over_threshold' => (bool) ($m['freeOverThreshold'] ?? false),
                'is_active' => true,
                'sort_order' => $i + 1,
            ]);
        }

        $known = ['India' => 'IN', 'United States' => 'US', 'United Kingdom' => 'GB', 'UAE' => 'AE'];
        $eu = [
            'DE' => 'Germany', 'FR' => 'France', 'IT' => 'Italy', 'ES' => 'Spain', 'NL' => 'Netherlands',
            'BE' => 'Belgium', 'AT' => 'Austria', 'IE' => 'Ireland', 'PT' => 'Portugal', 'LU' => 'Luxembourg',
            'SE' => 'Sweden', 'DK' => 'Denmark', 'FI' => 'Finland', 'PL' => 'Poland', 'GR' => 'Greece',
        ];
        $sort = 0;
        foreach ($c['countries'] as $name) {
            if (! isset($known[$name])) {
                continue; // "Other" is a storefront placeholder, not a country
            }
            Country::updateOrCreate(['code' => $known[$name]], ['name' => $name === 'UAE' ? 'United Arab Emirates' : $name, 'is_active' => true, 'sort_order' => ++$sort]);
        }
        foreach ($eu as $code => $name) {
            Country::updateOrCreate(['code' => $code], ['name' => $name, 'is_active' => true, 'sort_order' => ++$sort]);
        }

        foreach ($c['coupons'] as $cp) {
            Coupon::withTrashed()->updateOrCreate(['code' => strtoupper($cp['code'])], [
                'label' => $cp['label'],
                'type' => 'percent',
                'value' => $cp['percent'],
                'is_active' => true,
            ]);
        }
    }

    private function orderStages(): void
    {
        $codes = ['quality' => 'quality_check'];
        foreach ($this->d['orderStages'] as $i => $s) {
            OrderStage::updateOrCreate(['code' => $codes[$s['id']] ?? $s['id']], [
                'label' => $s['label'],
                'description' => $s['desc'],
                'sort_order' => $i + 1,
            ]);
        }
    }

    private function pages(): void
    {
        foreach ($this->d['policies'] as $slug => $p) {
            Page::updateOrCreate(['slug' => $slug], [
                'title' => $p['title'],
                'eyebrow' => $p['eyebrow'] ?? null,
                'intro' => $p['intro'] ?? null,
                'updated_label' => $p['updated'] ?? null,
                'sections' => self::clean($p['sections']),
                'is_active' => true,
            ]);
        }
    }

    private function faqs(): void
    {
        // Content fixes requested in brief §3.10.
        $fixes = [
            'Which payment methods do you accept?' => 'Visa, Mastercard and American Express via Stripe.',
            'Can I track my order?' => 'Yes. Sign in and open My Account → My Orders to see the status and tracking details of every order.',
        ];
        foreach ($this->d['faqs'] as $i => $group) {
            $cat = FaqCategory::updateOrCreate(['name' => $group['category']], ['sort_order' => $i + 1]);
            foreach ($group['items'] as $j => $item) {
                Faq::updateOrCreate(['category_id' => $cat->id, 'question' => $item['q']], [
                    'answer' => $fixes[$item['q']] ?? $item['a'],
                    'sort_order' => $j + 1,
                    'is_active' => true,
                ]);
            }
        }
    }

    private function testimonials(): void
    {
        foreach ($this->d['testimonials'] as $i => $t) {
            Testimonial::updateOrCreate(['name' => $t['name'], 'text' => $t['text']], [
                'location' => $t['location'],
                'rating' => $t['rating'],
                'initials' => $t['initials'],
                'product_label' => $t['product'] ?? null,
                'is_active' => true,
                'sort_order' => $i + 1,
            ]);
        }
    }
}
