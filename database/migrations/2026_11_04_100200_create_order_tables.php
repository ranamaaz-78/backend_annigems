<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_stages', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique(); // placed, crafting, quality_check, shipped, delivered
            $table->string('label');
            $table->string('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 20)->nullable()->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('email');
            $table->enum('placed_from', ['web', 'mobile'])->default('web');

            $table->char('currency', 3);
            $table->decimal('exchange_rate', 18, 8);
            $table->unsignedBigInteger('subtotal');
            $table->unsignedBigInteger('discount')->default(0);
            $table->unsignedBigInteger('shipping')->default(0);
            $table->unsignedBigInteger('tax')->default(0);
            $table->unsignedBigInteger('total');
            $table->unsignedBigInteger('total_eur');
            $table->decimal('tax_rate', 6, 4)->default(0);
            $table->string('coupon_code', 40)->nullable();
            $table->json('coupon_snapshot')->nullable();

            $table->string('shipping_method_code', 40);
            $table->string('shipping_method_name');
            $table->string('shipping_delivery_time')->nullable();
            $table->string('ship_name');
            $table->string('ship_phone', 40)->nullable();
            $table->string('ship_line1');
            $table->string('ship_city', 120);
            $table->string('ship_state', 120)->nullable();
            $table->string('ship_zip', 20);
            $table->string('ship_country', 120);
            $table->char('ship_country_code', 2)->nullable();

            $table->enum('status', ['pending_payment', 'paid', 'payment_failed', 'cancelled', 'refunded', 'partially_refunded'])->default('pending_payment');
            $table->enum('stage', ['placed', 'crafting', 'quality_check', 'shipped', 'delivered'])->nullable();

            $table->string('stripe_payment_intent_id')->nullable()->index();
            $table->string('stripe_customer_id')->nullable();
            $table->unsignedBigInteger('refunded_amount')->default(0);
            $table->timestamp('paid_at')->nullable();

            $table->string('carrier', 80)->nullable();
            $table->string('tracking_number', 120)->nullable();
            $table->string('tracking_url')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason')->nullable();

            $table->text('customer_note')->nullable();
            $table->boolean('stock_issue')->default(false);
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['stage']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->enum('kind', ['product', 'custom_ring']);
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('config_ring_id')->nullable()->constrained('config_rings')->nullOnDelete();
            $table->foreignId('config_stone_id')->nullable()->constrained('config_stones')->nullOnDelete();
            $table->string('name');
            $table->string('subtitle')->nullable();
            $table->string('image')->nullable();
            $table->string('size', 10)->nullable();
            $table->unsignedInteger('qty');
            $table->unsignedBigInteger('unit_price'); // order currency, minor
            $table->unsignedBigInteger('line_total'); // order currency, minor
            $table->unsignedBigInteger('unit_price_eur');
            $table->json('snapshot');
            $table->timestamps();
        });

        Schema::create('order_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->enum('field', ['status', 'stage']);
            $table->string('from', 40)->nullable();
            $table->string('to', 40);
            $table->text('note')->nullable();
            $table->foreignId('admin_user_id')->nullable()->constrained('admin_users')->nullOnDelete();
            $table->boolean('customer_notified')->default(false);
            $table->timestamps();
        });

        Schema::create('order_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('admin_user_id')->nullable()->constrained('admin_users')->nullOnDelete();
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('stripe_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_id')->unique();
            $table->string('type');
            $table->timestamp('processed_at')->nullable();
            $table->json('payload');
            $table->timestamps();
        });

        // Checkout Idempotency-Key replay store.
        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('key', 120);
            $table->string('request_hash', 64);
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'key']);
        });

        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token', 512);
            $table->enum('platform', ['ios', 'android']);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
            $table->unique(['token']);
        });
    }

    public function down(): void
    {
        foreach (['devices', 'idempotency_keys', 'stripe_events', 'order_notes', 'order_status_history', 'order_items', 'orders', 'order_stages'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
