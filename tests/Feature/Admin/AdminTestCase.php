<?php

namespace Tests\Feature\Admin;

use App\Models\AdminUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

abstract class AdminTestCase extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedStore();
    }

    /** Signed-in staff user with 2FA confirmed and passed for this session. */
    protected function actingAsStaff(string $role = 'Super Admin'): AdminUser
    {
        $admin = AdminUser::create(['name' => $role.' user', 'email' => strtolower(str_replace(' ', '', $role)).'@aanigems.test', 'password' => 'secret123']);
        $admin->forceFill(['two_factor_secret' => 'JBSWY3DPEHPK3PXP', 'two_factor_confirmed_at' => now()])->save();
        $admin->assignRole($role);
        $this->actingAs($admin, 'admin')->withSession(['admin_2fa_passed' => true, 'admin_last_activity' => time()]);

        return $admin;
    }

    protected function admin(string $method, string $uri, array $data = [])
    {
        return $this->json($method, '/api/v1/admin/'.ltrim($uri, '/'), $data);
    }
}
