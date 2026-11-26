<?php

use App\Models\Category;
use App\Models\Product;
use App\Support\Media;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Catalogue upgrade for an already seeded database (fresh installs get the same data from StorefrontSeeder):
 * - the two plain settings (r1 Aurora Solitaire, r2 Elise Vintage Halo) move from Rings to Mountings,
 * - the four Design Your Ring stones are added to Gemstones as loose stones (g1–g4 in storefront-seed.json).
 */
return new class extends Migration
{
    private const MOUNTINGS = ['r1', 'r2'];

    private const NOTE = 'Centre stone sold separately';

    public function up(): void
    {
        $mountings = Category::where('slug', 'mountings')->first();
        $gemstones = Category::where('slug', 'gemstones')->first();
        if (! $mountings || ! $gemstones) {
            return; // fresh install: the seeder creates everything
        }

        $seed = json_decode(file_get_contents(database_path('seeders/data/storefront-seed.json')), true);
        $sizes = $seed['catalog']['ringSizes'];

        DB::transaction(function () use ($seed, $sizes, $mountings, $gemstones) {
            foreach (Product::withTrashed()->whereIn('legacy_id', self::MOUNTINGS)->get() as $p) {
                $details = $p->details ?? [];
                if (! in_array(self::NOTE, $details, true)) {
                    array_unshift($details, self::NOTE);
                }
                $p->forceFill(['category_id' => $mountings->id, 'details' => $details, 'has_sizes' => true, 'sizes' => $p->sizes ?: $sizes])->save();
            }

            foreach (collect($seed['catalog']['products'])->where('category', 'gemstones') as $g) {
                if (Product::withTrashed()->where('legacy_id', $g['id'])->exists()) {
                    continue;
                }
                $product = Product::create([
                    'category_id' => $gemstones->id,
                    'legacy_id' => $g['id'],
                    'slug' => Str::slug($g['name']), // same rule as StorefrontSeeder
                    'name' => $g['name'],
                    'subtitle' => $g['subtitle'],
                    'description' => $g['description'],
                    'price' => (int) round($g['price'] * 100),
                    'metal' => $g['metal'],
                    'stone' => $g['stone'],
                    'weight' => $g['weight'],
                    'details' => $g['details'],
                    'tags' => $g['tags'],
                    'has_sizes' => false,
                    // Starter stock so the stones can be ordered; set the real quantity in Admin > Products.
                    'stock_qty' => 10,
                    'track_stock' => true,
                    'is_active' => true,
                    'published_at' => now(),
                ]);
                $product->images()->create(['path' => Media::normalize($g['image']), 'alt' => $g['name'], 'sort_order' => 0]);
            }
        });
    }

    public function down(): void
    {
        $rings = Category::where('slug', 'rings')->first();
        if ($rings) {
            foreach (Product::withTrashed()->whereIn('legacy_id', self::MOUNTINGS)->get() as $p) {
                $p->forceFill(['category_id' => $rings->id, 'details' => array_values(array_diff($p->details ?? [], [self::NOTE]))])->save();
            }
        }
        // Stones that were ordered stay (orders keep their history); the rest are removed.
        Product::withTrashed()->whereIn('legacy_id', ['g1', 'g2', 'g3', 'g4'])
            ->whereNotIn('id', DB::table('order_items')->whereNotNull('product_id')->select('product_id'))
            ->forceDelete();
    }
};
