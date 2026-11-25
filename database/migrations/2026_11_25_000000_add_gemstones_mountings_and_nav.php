<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Navbar: Gemstones, Mountings, Jewellery, Design Your Ring, About, Contact.
 * Adds the two new categories (images are placeholders, replace them in Admin > Categories)
 * and rewrites the mobile menu content block to the same order.
 */
return new class extends Migration
{
    public function up(): void
    {
        $max = (int) DB::table('categories')->max('sort_order');
        foreach (['gemstones' => ['Gemstones', 'images/ring1_emerald.jpg'], 'mountings' => ['Mountings', 'images/ring2_plain.jpg']] as $slug => [$name, $image]) {
            if (! DB::table('categories')->where('slug', $slug)->exists()) {
                DB::table('categories')->insert([
                    'name' => $name, 'slug' => $slug, 'image' => $image, 'sort_order' => ++$max,
                    'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }

        $nav = [
            ['label' => 'Home', 'to' => '/'],
            ['label' => 'Gemstones', 'to' => '/shop?cat=gemstones'],
            ['label' => 'Mountings', 'to' => '/shop?cat=mountings'],
            ['label' => 'Jewellery', 'to' => '/shop?cat=jewellery'],
            ['label' => 'Design Your Ring', 'to' => '/design-your-ring', 'highlight' => true],
            ['label' => 'About', 'to' => '/about'],
            ['label' => 'Contact', 'to' => '/contact'],
            ['label' => 'Wishlist', 'to' => '/wishlist'],
            ['label' => 'Services', 'to' => '/services'],
            ['label' => 'Wholesale / B2B', 'to' => '/wholesale'],
            ['label' => 'Track Order', 'to' => '/track-order'],
        ];
        DB::table('content_blocks')->where('key', 'navigation.mobile')->update(['value' => json_encode($nav), 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('categories')->whereIn('slug', ['gemstones', 'mountings'])->whereNotExists(
            fn ($q) => $q->from('products')->whereColumn('products.category_id', 'categories.id')
        )->delete();
    }
};
