<?php

namespace Database\Seeders;

use App\Support\Permissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (array_keys(Permissions::ALL) as $name) {
            Permission::findOrCreate($name, 'admin');
        }

        foreach (Permissions::ROLES as $roleName => $perms) {
            $role = Role::findOrCreate($roleName, 'admin');
            $role->syncPermissions($perms === '*' ? array_keys(Permissions::ALL) : $perms);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
