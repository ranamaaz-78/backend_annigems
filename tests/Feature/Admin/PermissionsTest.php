<?php

namespace Tests\Feature\Admin;

use App\Models\AdminUser;

class PermissionsTest extends AdminTestCase
{
    public function test_two_factor_is_enforced_on_modules(): void
    {
        $admin = AdminUser::create(['name' => 'N', 'email' => 'n@x.com', 'password' => 'secret123']);
        $admin->assignRole('Super Admin');
        $this->actingAs($admin, 'admin')->withSession(['admin_last_activity' => time()]);
        $this->admin('GET', 'dashboard')->assertStatus(403)->assertJsonPath('code', 'two_factor_setup_required');
    }

    public function test_idle_session_expires(): void
    {
        $this->actingAsStaff();
        $this->withSession(['admin_2fa_passed' => true, 'admin_last_activity' => time() - 3600]);
        $this->admin('GET', 'dashboard')->assertStatus(401)->assertJsonPath('code', 'session_expired');
    }

    public function test_support_role(): void
    {
        $this->actingAsStaff('Support');
        $this->admin('GET', 'dashboard')->assertOk();
        $this->admin('GET', 'orders')->assertOk();
        $this->admin('GET', 'customers')->assertOk();
        $this->admin('GET', 'products')->assertForbidden();
        $this->admin('GET', 'pricing/gold')->assertForbidden();
        $this->admin('GET', 'coupons')->assertForbidden();
        $this->admin('PUT', 'customers/1/active', ['is_active' => false])->assertForbidden();
        $this->admin('POST', 'orders/AG-10001/refund', ['amount' => 1])->assertForbidden();
        $this->admin('POST', 'orders/AG-10001/cancel')->assertForbidden();
    }

    public function test_manager_role(): void
    {
        $this->actingAsStaff('Manager');
        foreach (['products', 'categories', 'reviews', 'configurator/rings', 'configurator/combos', 'pricing/gold', 'pricing/currencies', 'pricing/commerce', 'pricing/shipping-methods', 'pricing/countries', 'coupons', 'orders', 'customers'] as $uri) {
            $this->admin('GET', $uri)->assertOk();
        }
    }

    public function test_super_admin_sees_everything(): void
    {
        $this->actingAsStaff();
        $this->admin('GET', 'products')->assertOk();
        $this->admin('GET', 'auth/me')->assertOk()->assertJsonPath('data.permissions', ['*']);
    }
}
