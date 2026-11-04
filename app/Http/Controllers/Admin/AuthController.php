<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

/**
 * @group Admin: Auth
 *
 * Staff session authentication with mandatory TOTP 2FA.
 */
class AuthController extends Controller
{
    public function __construct(private TwoFactorService $twoFactor) {}

    /** Current staff user and 2FA state. */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user('admin');

        return response()->json(['data' => $user ? $this->present($request, $user) : null]);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = AdminUser::where('email', Str::lower($data['email']))->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }
        if (! $user->is_active) {
            throw ValidationException::withMessages(['email' => 'This staff account is disabled.']);
        }

        Auth::guard('admin')->login($user);
        $request->session()->regenerate();
        $request->session()->put('admin_2fa_passed', false);
        $request->session()->put('admin_last_activity', time());

        return response()->json(['data' => $this->present($request, $user)]);
    }

    /** Starts (or restarts) TOTP setup. Only allowed while 2FA is not confirmed. */
    public function setupTwoFactor(Request $request): JsonResponse
    {
        $user = $request->user('admin');
        abort_if($user->hasTwoFactorEnabled(), 409, 'Two-factor authentication is already set up.');

        $secret = $this->twoFactor->generateSecret();
        $user->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => null])->save();
        $url = $this->twoFactor->otpauthUrl($user, $secret);

        return response()->json(['data' => [
            'secret' => $secret,
            'otpauth_url' => $url,
            'qr_svg' => $this->twoFactor->qrSvg($url),
        ]]);
    }

    public function confirmTwoFactor(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string']]);
        $user = $request->user('admin');
        abort_if($user->hasTwoFactorEnabled(), 409, 'Two-factor authentication is already set up.');

        if (! $user->two_factor_secret || ! $this->twoFactor->verify($user->two_factor_secret, $data['code'])) {
            throw ValidationException::withMessages(['code' => 'The code is not valid. Check your authenticator app and try again.']);
        }

        $codes = $this->twoFactor->generateRecoveryCodes();
        $user->forceFill(['two_factor_confirmed_at' => now(), 'two_factor_recovery_codes' => $codes, 'last_login_at' => now()])->save();
        $request->session()->put('admin_2fa_passed', true);
        activity('auth')->causedBy($user)->log('2FA set up');

        return response()->json(['data' => $this->present($request, $user->fresh()), 'recovery_codes' => $codes]);
    }

    public function challenge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['nullable', 'string', 'required_without:recovery_code'],
            'recovery_code' => ['nullable', 'string'],
        ]);
        $user = $request->user('admin');
        abort_unless($user->hasTwoFactorEnabled(), 409, 'Set up two-factor authentication first.');

        $ok = ! empty($data['code'])
            ? $this->twoFactor->verify($user->two_factor_secret, $data['code'])
            : $this->twoFactor->useRecoveryCode($user, $data['recovery_code']);

        if (! $ok) {
            throw ValidationException::withMessages([
                empty($data['code']) ? 'recovery_code' : 'code' => 'The code is not valid.',
            ]);
        }

        $request->session()->regenerate();
        $request->session()->put('admin_2fa_passed', true);
        $user->forceFill(['last_login_at' => now()])->save();
        activity('auth')->causedBy($user)->log('Signed in');

        return response()->json(['data' => $this->present($request, $user)]);
    }

    public function regenerateRecoveryCodes(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password:admin']]);
        $codes = $this->twoFactor->generateRecoveryCodes();
        $request->user('admin')->forceFill(['two_factor_recovery_codes' => $codes])->save();

        return response()->json(['recovery_codes' => $codes]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user('admin');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'current_password' => ['nullable', 'required_with:password', 'current_password:admin'],
            'password' => ['nullable', 'confirmed', PasswordRule::min(8)],
        ]);
        $user->name = $data['name'];
        if (! empty($data['password'])) {
            $user->password = $data['password'];
        }
        $user->save();

        return response()->json(['data' => $this->present($request, $user)]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('admin')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Signed out.']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        Password::broker('admin_users')->sendResetLink(['email' => Str::lower($request->input('email'))]);

        return response()->json(['message' => 'If that email belongs to a staff account, a reset link is on its way.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $status = Password::broker('admin_users')->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (AdminUser $user, string $password) {
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'This reset link is invalid or has expired.']);
        }

        return response()->json(['message' => 'Your password has been reset. You can sign in now.']);
    }

    private function present(Request $request, AdminUser $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->getRoleNames()->values(),
            'permissions' => $user->hasRole('Super Admin')
                ? ['*']
                : $user->getAllPermissions()->pluck('name')->values(),
            'two_factor' => [
                'enabled' => $user->hasTwoFactorEnabled(),
                'passed' => (bool) $request->session()->get('admin_2fa_passed'),
                'recovery_codes_left' => count($user->two_factor_recovery_codes ?? []),
            ],
            'idle_timeout_minutes' => config('auth.admin_idle_minutes'),
            'last_login_at' => $user->last_login_at?->toIso8601String(),
        ];
    }
}
