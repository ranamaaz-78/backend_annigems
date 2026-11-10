<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * B2B: sales persons (admin users with the Sales Person role), business accounts (users with
 * account_type=business), membership tiers with a discount per category, B2B order fields
 * (approval + commission snapshot) and commission payouts.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('account_type', ['customer', 'business'])->default('customer')->change();
        });

        Schema::create('b2b_tiers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // One row per tier and category; category_id null = the Design Your Ring (custom ring) row.
        Schema::create('b2b_tier_discounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tier_id')->constrained('b2b_tiers')->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->cascadeOnDelete();
            $table->decimal('percent', 5, 2)->default(0);
            $table->timestamps();
            $table->unique(['tier_id', 'category_id']);
        });

        Schema::create('sales_reps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_user_id')->unique()->constrained('admin_users')->cascadeOnDelete();
            $table->string('phone', 40)->nullable();
            $table->decimal('commission_rate', 5, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('business_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('company_name');
            $table->string('business_type', 80)->nullable();
            $table->string('tax_id', 60)->nullable();
            $table->foreignId('tier_id')->constrained('b2b_tiers')->restrictOnDelete();
            $table->foreignId('sales_rep_id')->nullable()->constrained('admin_users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index('sales_rep_id');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->enum('status', ['pending_payment', 'paid', 'payment_failed', 'cancelled', 'refunded', 'partially_refunded', 'awaiting_approval', 'confirmed'])
                ->default('pending_payment')->change();
            $table->enum('account_type', ['customer', 'business'])->default('customer')->after('user_id');
            $table->foreignId('sales_rep_id')->nullable()->after('account_type')->constrained('admin_users')->nullOnDelete();
            $table->string('b2b_tier_name', 60)->nullable()->after('sales_rep_id');
            $table->string('company_name')->nullable()->after('b2b_tier_name');
            $table->decimal('commission_rate', 5, 2)->nullable();
            $table->unsignedBigInteger('commission_base')->nullable();
            $table->unsignedBigInteger('commission_amount')->nullable();
            $table->unsignedBigInteger('commission_amount_eur')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->index(['account_type', 'created_at']);
            $table->index(['sales_rep_id', 'created_at']);
        });

        Schema::create('commission_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sales_rep_id')->constrained('admin_users')->cascadeOnDelete();
            $table->unsignedBigInteger('amount_eur');
            $table->date('paid_at');
            $table->string('method', 60)->nullable();
            $table->string('reference', 120)->nullable();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('admin_users')->nullOnDelete();
            $table->timestamps();
            $table->index(['sales_rep_id', 'paid_at']);
        });

        $now = now();
        DB::table('b2b_tiers')->insert([
            ['name' => 'Platinum', 'sort_order' => 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Gold', 'sort_order' => 2, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Silver', 'sort_order' => 3, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);

        $this->seedPermissions();
    }

    /** New B2B permissions + the Sales Person role (additive: existing roles keep their custom changes). */
    private function seedPermissions(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        foreach (['b2b.view', 'b2b.manage', 'b2b.orders', 'b2b.payouts', 'b2b.sales'] as $name) {
            Permission::findOrCreate($name, 'admin');
        }
        Role::findOrCreate('Sales Person', 'admin')->givePermissionTo('b2b.sales');
        if ($manager = Role::where('name', 'Manager')->where('guard_name', 'admin')->first()) {
            $manager->givePermissionTo(['b2b.view', 'b2b.manage', 'b2b.orders']);
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Schema::dropIfExists('commission_payouts');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['account_type', 'created_at']);
            $table->dropIndex(['sales_rep_id', 'created_at']);
            $table->dropConstrainedForeignId('sales_rep_id');
            $table->dropColumn(['account_type', 'b2b_tier_name', 'company_name', 'commission_rate', 'commission_base', 'commission_amount', 'commission_amount_eur', 'approved_at']);
        });
        Schema::dropIfExists('business_profiles');
        Schema::dropIfExists('sales_reps');
        Schema::dropIfExists('b2b_tier_discounts');
        Schema::dropIfExists('b2b_tiers');
        Role::where('name', 'Sales Person')->where('guard_name', 'admin')->delete();
        Permission::whereIn('name', ['b2b.view', 'b2b.manage', 'b2b.orders', 'b2b.payouts', 'b2b.sales'])->where('guard_name', 'admin')->delete();
    }
};
