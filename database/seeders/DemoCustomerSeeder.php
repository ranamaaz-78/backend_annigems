<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/** Demo customer for local/dev only. */
class DemoCustomerSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::withTrashed()->firstOrCreate(['email' => 'demo@aanigems.com'], [
            'first_name' => 'Demo',
            'last_name' => 'Customer',
            'password' => 'Demo@1234',
            'is_active' => true,
        ]);
        if (! $user->addresses()->exists()) {
            $user->addresses()->create([
                'label' => 'Home', 'name' => 'Demo Customer', 'phone' => '+91 98765 43210',
                'line1' => '21 Linking Road, Bandra West', 'city' => 'Mumbai', 'state' => 'Maharashtra',
                'zip' => '400050', 'country_code' => 'IN', 'is_default' => true,
            ]);
        }
    }
}
