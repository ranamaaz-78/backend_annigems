<?php

namespace App\Http\Controllers\Admin\System;

use App\Http\Controllers\Controller;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/** @group Admin: Staff & roles */
class RoleController extends Controller
{
    /** Roles with their permissions + the permission catalogue (matrix). */
    public function index(): JsonResponse
    {
        return response()->json(['data' => [
            'permissions' => collect(Permissions::ALL)->map(fn ($label, $name) => ['name' => $name, 'label' => $label])->values(),
            'roles' => Role::where('guard_name', 'admin')->with('permissions:id,name')->withCount('users')->orderBy('id')->get()->map(fn ($r) => [
                'id' => $r->id, 'name' => $r->name, 'locked' => $r->name === 'Super Admin',
                'permissions' => $r->permissions->pluck('name'), 'users_count' => $r->users_count,
            ]),
        ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('roles', 'name')->where('guard_name', 'admin')],
            'permissions' => ['array'], 'permissions.*' => [Rule::in(array_keys(Permissions::ALL))],
        ]);
        Role::create(['name' => $data['name'], 'guard_name' => 'admin'])->syncPermissions($data['permissions'] ?? []);

        return $this->index();
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $role = Role::where('guard_name', 'admin')->findOrFail($id);
        if ($role->name === 'Super Admin') {
            throw ValidationException::withMessages(['role' => 'Super Admin always has every permission.']);
        }
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:60', Rule::unique('roles', 'name')->where('guard_name', 'admin')->ignore($role->id)],
            'permissions' => ['present', 'array'], 'permissions.*' => [Rule::in(array_keys(Permissions::ALL))],
        ]);
        $old = $role->permissions->pluck('name')->all();
        if (isset($data['name'])) {
            $role->update(['name' => $data['name']]);
        }
        $role->syncPermissions($data['permissions']);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        activity('staff')->causedBy($request->user('admin'))->withProperties(['role' => $role->name, 'old' => $old, 'new' => $data['permissions']])->log('Role permissions changed');

        return $this->index();
    }

    public function destroy(int $id): JsonResponse
    {
        $role = Role::where('guard_name', 'admin')->withCount('users')->findOrFail($id);
        if (in_array($role->name, array_keys(Permissions::ROLES), true) || $role->users_count > 0) {
            throw ValidationException::withMessages(['role' => 'Built-in roles and roles with staff cannot be deleted.']);
        }
        $role->delete();

        return $this->index();
    }
}
