<?php

namespace Tests\Feature\Admin;

use App\Models\AdminUser;
use App\Services\TwoFactorService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_login_then_forced_two_factor_setup(): void
    {
        $admin = AdminUser::create(['name' => 'A', 'email' => 'a@x.com', 'password' => 'secret123']);
        $admin->assignRole('Super Admin');

        $this->postJson('/api/v1/admin/auth/login', ['email' => 'a@x.com', 'password' => 'wrong'])->assertStatus(422);

        $this->postJson('/api/v1/admin/auth/login', ['email' => 'a@x.com', 'password' => 'secret123'])
            ->assertOk()->assertJsonPath('data.two_factor.enabled', false);

        // Any protected screen is blocked until 2FA is set up.
        $this->putJson('/api/v1/admin/profile', ['name' => 'B'])
            ->assertStatus(403)->assertJsonPath('code', 'two_factor_setup_required');

        $secret = $this->postJson('/api/v1/admin/auth/two-factor/setup')->assertOk()->json('data.secret');
        $this->postJson('/api/v1/admin/auth/two-factor/confirm', ['code' => '000000'])->assertStatus(422);
        $code = app(TwoFactorService::class)->currentCode($secret);
        $res = $this->postJson('/api/v1/admin/auth/two-factor/confirm', ['code' => $code])->assertOk();
        $this->assertCount(8, $res->json('recovery_codes'));

        $this->putJson('/api/v1/admin/profile', ['name' => 'B'])->assertOk()->assertJsonPath('data.name', 'B');
    }

    public function test_two_factor_challenge_required_on_new_session(): void
    {
        $tf = app(TwoFactorService::class);
        $admin = AdminUser::create(['name' => 'A', 'email' => 'a@x.com', 'password' => 'secret123']);
        $secret = $tf->generateSecret();
        $admin->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => now(), 'two_factor_recovery_codes' => ['abcde-fghij']])->save();
        $admin->assignRole('Support');

        $this->postJson('/api/v1/admin/auth/login', ['email' => 'a@x.com', 'password' => 'secret123'])->assertOk();
        $this->putJson('/api/v1/admin/profile', ['name' => 'B'])
            ->assertStatus(403)->assertJsonPath('code', 'two_factor_challenge_required');

        $this->postJson('/api/v1/admin/auth/two-factor/challenge', ['recovery_code' => 'nope'])->assertStatus(422);
        $this->postJson('/api/v1/admin/auth/two-factor/challenge', ['recovery_code' => 'abcde-fghij'])
            ->assertOk()->assertJsonPath('data.two_factor.passed', true);
        $this->assertSame([], $admin->fresh()->two_factor_recovery_codes);
        $this->putJson('/api/v1/admin/profile', ['name' => 'B'])->assertOk();
    }

    public function test_unauthenticated_and_inactive(): void
    {
        $this->putJson('/api/v1/admin/profile', [])->assertStatus(401);
        AdminUser::create(['name' => 'A', 'email' => 'a@x.com', 'password' => 'secret123', 'is_active' => false]);
        $this->postJson('/api/v1/admin/auth/login', ['email' => 'a@x.com', 'password' => 'secret123'])->assertStatus(422);
    }

    public function test_admin_spa_is_served(): void
    {
        $this->withoutVite();
        $this->get('/admin/orders/AG-10001')->assertOk()->assertSee('admin-root', false);
    }
}
