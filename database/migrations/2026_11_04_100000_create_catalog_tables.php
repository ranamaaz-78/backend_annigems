<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label', 40)->nullable();
            $table->string('name');
            $table->string('phone', 40)->nullable();
            $table->string('line1');
            $table->string('city', 120);
            $table->string('state', 120)->nullable();
            $table->string('zip', 20);
            $table->char('country_code', 2);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('image')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->string('legacy_id', 40)->nullable()->unique(); // storefront ids: r1, n1…
            $table->string('sku', 64)->nullable()->unique();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('subtitle')->nullable();
            $table->text('description')->nullable();
            $table->unsignedBigInteger('price'); // EUR minor
            $table->unsignedBigInteger('compare_at_price')->nullable(); // EUR minor
            $table->enum('badge', ['Bestseller', 'Sale', 'New', 'Limited', 'Iconic'])->nullable();
            $table->string('metal', 80)->nullable();
            $table->string('stone', 120)->nullable();
            $table->string('weight', 40)->nullable();
            $table->json('details')->nullable();
            $table->json('tags')->nullable();
            $table->decimal('rating', 2, 1)->default(0);
            $table->unsignedInteger('reviews_count')->default(0);
            $table->boolean('has_sizes')->default(false);
            $table->json('sizes')->nullable();
            $table->integer('stock_qty')->default(0);
            $table->boolean('track_stock')->default(true);
            $table->boolean('is_customizable')->default(false);
            $table->boolean('is_featured')->default(false);
            $table->integer('featured_sort')->default(0);
            $table->boolean('is_new_arrival')->default(false);
            $table->integer('new_arrival_sort')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['is_active', 'category_id']);
        });

        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('alt')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->nullable()->constrained()->cascadeOnDelete(); // null = generic
            $table->string('name');
            $table->string('location')->nullable();
            $table->string('initials', 4)->nullable();
            $table->unsignedTinyInteger('rating')->default(5);
            $table->text('text');
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('wishlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'product_id']);
        });

        Schema::create('config_rings', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('type')->nullable();
            $table->string('setting')->nullable();
            $table->unsignedTinyInteger('karat')->default(18);
            $table->enum('metal_color', ['yellow', 'white', 'rose'])->nullable();
            $table->decimal('gold_weight_g', 8, 3);
            $table->unsignedBigInteger('craft_fee'); // EUR minor
            $table->json('sizes');
            $table->string('image')->nullable();
            $table->text('description')->nullable();
            $table->string('delivery_text')->default('4-6 weeks');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('config_stones', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('origin')->nullable();
            $table->unsignedBigInteger('price'); // EUR minor, fixed
            $table->string('rarity', 40)->nullable();
            $table->decimal('carat', 5, 2)->nullable();
            $table->string('color', 20)->nullable();
            $table->string('glow', 60)->nullable();
            $table->text('gem_style')->nullable();
            $table->boolean('uses_diamond_animation')->default(false);
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('config_ring_stone', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ring_id')->constrained('config_rings')->cascadeOnDelete();
            $table->foreignId('stone_id')->constrained('config_stones')->cascadeOnDelete();
            $table->string('image')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['ring_id', 'stone_id']);
        });
    }

    public function down(): void
    {
        foreach (['config_ring_stone', 'config_stones', 'config_rings', 'wishlists', 'product_reviews', 'product_images', 'products', 'categories', 'addresses'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
