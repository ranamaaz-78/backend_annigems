<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            AdminUserSeeder::class,
            StorefrontSeeder::class,
            CurrencySeeder::class,
        ]);

        if (app()->environment(['local', 'development', 'testing'])) {
            $this->call(DemoCustomerSeeder::class);
        }
    }
}
