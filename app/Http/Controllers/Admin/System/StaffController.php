<?php

namespace App\Http\Controllers\Admin\System;

use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

/** @group Admin: Staff & roles */
class StaffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = AdminUser::with('roles:id,name')->orderBy('name');
        if (($t = trim((string) $request->input('q'))) !== '') {
            $q->where(fn ($w) => $w->where('name', 'like', "%{$t}%")->orWhere('email', 'like', "%{$t}%"));
        }
        $page = $q->paginate(50);

        return response()->json([
            'data' => collect($page->items())->map(fn ($u) => $this->row($u)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
        ]);
    }

    private function row(AdminUser $u): array
    {
        return [
            'id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'is_active' => $u->is_active,
            'roles' => $u->roles->pluck('name'), 'two_factor_enabled' => $u->hasTwoFactorEnabled(),
            'last_login_at' => $u->last_login_at?->toIso8601String(), 'created_at' => $u->created_at->toIso8601String(),
        ];
    }

    /** Creates a staff user. Without a password, an invitation (reset link) is emailed. 2FA is set up on first login. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:admin_users,email'],
            'password' => ['nullable', PasswordRule::min(10)],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => [Rule::exists('roles', 'name')->where('guard_name', 'admin')],
            'is_active' => ['boolean'],
        ]);
        $user = AdminUser::create([
            'name' => $data['name'], 'email' => Str::lower($data['email']),
            'password' => $data['password'] ?? Str::random(40), 'is_active' => $data['is_active'] ?? true,
        ]);
        $user->syncRoles($data['roles']);
        if (empty($data['password'])) {
            Password::broker('admin_users')->sendResetLink(['email' => $user->email]);
        }
        activity('staff')->causedBy($request->user('admin'))->performedOn($user)->withProperties(['roles' => $data['roles']])->log('Staff user created');

        return response()->json(['data' => $this->row($user->load('roles')), 'message' => empty($data['password']) ? 'Staff user created; an invitation email with a password link was sent.' : 'Staff user created.'], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = AdminUser::findOrFail($id);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', Rule::unique('admin_users', 'email')->ignore($user->id)],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => [Rule::exists('roles', 'name')->where('guard_name', 'admin')],
            'is_active' => ['boolean'],
        ]);
        $this->guardLastSuperAdmin($request, $user, $data['roles'], $data['is_active'] ?? true);

        $user->update(['name' => $data['name'], 'email' => Str::lower($data['email']), 'is_active' => $data['is_active'] ?? $user->is_active]);
        $before = $user->getRoleNames()->all();
        $user->syncRoles($data['roles']);
        if ($before !== $data['roles']) {
            activity('staff')->causedBy($request->user('admin'))->performedOn($user)->withProperties(['old' => $before, 'new' => $data['roles']])->log('Roles changed');
        }

        return response()->json(['data' => $this->row($user->fresh('roles')), 'message' => 'Saved.']);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = AdminUser::findOrFail($id);
        if ($user->is($request->user('admin'))) {
            throw ValidationException::withMessages(['staff' => 'You cannot delete your own account.']);
        }
        $this->guardLastSuperAdmin($request, $user, [], false);
        $user->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    /** Clears 2FA: the staff member must set it up again on next login. */
    public function resetTwoFactor(Request $request, int $id): JsonResponse
    {
        $user = AdminUser::findOrFail($id);
        $user->forceFill(['two_factor_secret' => null, 'two_factor_recovery_codes' => null, 'two_factor_confirmed_at' => null])->save();
        activity('staff')->causedBy($request->user('admin'))->performedOn($user)->log('2FA reset');

        return response()->json(['data' => $this->row($user->load('roles')), 'message' => '2FA reset. They will set it up again at next sign-in.']);
    }

    public function sendPasswordReset(int $id): JsonResponse
    {
        $user = AdminUser::findOrFail($id);
        Password::broker('admin_users')->sendResetLink(['email' => $user->email]);

        return response()->json(['message' => 'Password reset link sent to '.$user->email.'.']);
    }

    private function guardLastSuperAdmin(Request $request, AdminUser $user, array $newRoles, bool $active): void
    {
        if (! $user->hasRole('Super Admin') || (in_array('Super Admin', $newRoles, true) && $active)) {
            return;
        }
        $others = Role::findByName('Super Admin', 'admin')->users()->where('admin_users.id', '!=', $user->id)->where('is_active', true)->count();
        if ($others === 0) {
            throw ValidationException::withMessages(['roles' => 'There must always be at least one active Super Admin.']);
        }
    }
}
