<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value')->nullable();
            $table->timestamps();
        });

        Schema::create('gold_rates', function (Blueprint $table) {
            $table->id();
            $table->enum('source', ['api', 'manual']);
            $table->unsignedBigInteger('rate_per_oz'); // EUR minor
            $table->timestamp('fetched_at');
            $table->string('provider', 40)->nullable();
            $table->json('raw')->nullable();
            $table->timestamps();
            $table->index(['source', 'fetched_at']);
        });

        Schema::create('currencies', function (Blueprint $table) {
            $table->id();
            $table->char('code', 3)->unique();
            $table->string('symbol', 8);
            $table->string('name');
            $table->unsignedTinyInteger('decimals')->default(2);
            $table->boolean('is_base')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->char('currency_code', 3);
            $table->decimal('rate', 18, 8); // 1 EUR = rate × currency
            $table->enum('source', ['api', 'manual']);
            $table->timestamp('fetched_at');
            $table->timestamps();
            $table->index(['currency_code', 'source', 'fetched_at']);
        });

        Schema::create('shipping_methods', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('name');
            $table->string('delivery_time')->nullable();
            $table->unsignedBigInteger('price'); // EUR minor
            $table->boolean('free_over_threshold')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('countries', function (Blueprint $table) {
            $table->id();
            $table->char('code', 2)->unique();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('label')->nullable();
            $table->enum('type', ['percent', 'fixed']);
            $table->unsignedBigInteger('value'); // percent (e.g. 10) or EUR minor
            $table->unsignedBigInteger('min_subtotal')->nullable(); // EUR minor
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('per_user_limit')->nullable();
            $table->unsignedInteger('used_count')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        foreach (['coupons', 'countries', 'shipping_methods', 'exchange_rates', 'currencies', 'gold_rates', 'settings'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
