<?php

namespace Database\Seeders;

use App\Models\AdminUser;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class AdminUserSeeder extends Seeder
{
    /** Super Admin from ADMIN_EMAIL / ADMIN_PASSWORD; 2FA is set up on first login. */
    public function run(): void
    {
        $email = Str::lower(env('ADMIN_EMAIL', 'admin@aanigems.com'));
        $admin = AdminUser::firstOrCreate(
            ['email' => $email],
            ['name' => 'Super Admin', 'password' => env('ADMIN_PASSWORD', 'ChangeMe@123'), 'is_active' => true]
        );
        $admin->syncRoles(['Super Admin']);
    }
}
