<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Mail\PasswordChangedMail;
use App\Mail\WelcomeMail;
use App\Models\User;
use App\Services\Auth\GoogleTokenVerifier;
use App\Services\Auth\InvalidGoogleToken;
use App\Services\Auth\PasswordResetCodeService;
use App\Services\CurrencyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/**
 * @group Auth
 *
 * Customer authentication. Successful calls return `{ data: { user, token, token_type, expires_at } }`.
 * Send the token as `Authorization: Bearer <token>`.
 */
class AuthController extends Controller
{
    /**
     * Register
     *
     * @unauthenticated
     *
     * @bodyParam first_name string required Example: Priya
     * @bodyParam last_name string required Example: Mehta
     * @bodyParam email string required Example: priya@example.com
     * @bodyParam password string required Min 8 characters. Example: secret123
     * @bodyParam password_confirmation string required Example: secret123
     * @bodyParam device_name string Required on mobile. Example: iPhone 16
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:80'],
            'last_name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'terms' => ['sometimes', 'accepted'],
            'device_name' => [$this->isMobile($request) ? 'required' : 'nullable', 'string', 'max:120'],
        ], $this->messages());

        $email = Str::lower(trim($data['email']));
        if (User::withTrashed()->where('email', $email)->exists()) {
            throw ValidationException::withMessages(['email' => 'An account with this email already exists. Please sign in.']);
        }

        $user = User::create([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $email,
            'password' => $data['password'],
            'preferred_currency' => $this->currencyHint(),
            'last_login_at' => now(),
        ]);
        Mail::to($user->email)->queue(new WelcomeMail($user));

        return $this->tokenResponse($request, $user, 201);
    }

    /**
     * Login
     *
     * @unauthenticated
     *
     * @bodyParam email string required Example: demo@aanigems.com
     * @bodyParam password string required Example: Demo@1234
     * @bodyParam device_name string Required on mobile. Example: iPhone 16
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => [$this->isMobile($request) ? 'required' : 'nullable', 'string', 'max:120'],
        ], $this->messages());

        $user = User::where('email', Str::lower(trim($data['email'])))->first();
        if (! $user) {
            throw ValidationException::withMessages(['email' => 'No account found with this email.']);
        }
        if (! $user->hasPassword()) {
            throw ValidationException::withMessages(['email' => 'This account uses Google. Please continue with Google.']);
        }
        if (! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => 'Incorrect password. Please try again.']);
        }
        if (! $user->is_active) {
            throw ValidationException::withMessages(['email' => 'This account is disabled. Please contact us.']);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return $this->tokenResponse($request, $user);
    }

    /**
     * Continue with Google
     *
     * Send the Google **ID token** (web: Google Identity Services; mobile: native Google Sign-In).
     *
     * @unauthenticated
     *
     * @bodyParam id_token string required
     * @bodyParam device_name string Required on mobile. Example: Pixel 9
     */
    public function google(Request $request, GoogleTokenVerifier $verifier): JsonResponse
    {
        $data = $request->validate([
            'id_token' => ['required', 'string'],
            'device_name' => [$this->isMobile($request) ? 'required' : 'nullable', 'string', 'max:120'],
        ], $this->messages());

        $ids = config('services.google.client_ids');
        $allowed = $this->isMobile($request) ? [$ids['ios'], $ids['android'], $ids['web']] : [$ids['web']];

        try {
            $g = $verifier->verify($data['id_token'], $allowed);
        } catch (InvalidGoogleToken $e) {
            throw ValidationException::withMessages(['id_token' => 'Google sign-in failed. Please try again.']);
        }

        $email = Str::lower($g['email']);
        $created = false;
        $user = DB::transaction(function () use ($g, $email, &$created) {
            if ($user = User::where('google_id', $g['sub'])->first()) {
                return $user;
            }
            $user = User::where('email', $email)->first();
            if ($user) {
                if (! $g['email_verified']) {
                    throw ValidationException::withMessages(['id_token' => 'Your Google email is not verified. Please sign in with your password.']);
                }
                $user->forceFill(['google_id' => $g['sub'], 'avatar_url' => $user->avatar_url ?: $g['picture']])->save();

                return $user;
            }
            $created = true;

            return User::create([
                'first_name' => $g['given_name'] ?: Str::before($email, '@'),
                'last_name' => $g['family_name'] ?? '',
                'email' => $email,
                'password' => null,
                'google_id' => $g['sub'],
                'avatar_url' => $g['picture'],
                'preferred_currency' => $this->currencyHint(),
            ]);
        });

        if (! $user->is_active) {
            throw ValidationException::withMessages(['id_token' => 'This account is disabled. Please contact us.']);
        }
        $user->forceFill(['last_login_at' => now()])->save();
        if ($created) {
            Mail::to($user->email)->queue(new WelcomeMail($user));
        }

        return $this->tokenResponse($request, $user, $created ? 201 : 200);
    }

    /**
     * Forgot password
     *
     * Emails a 6-digit code (valid 15 minutes). Always returns the same generic message.
     *
     * @unauthenticated
     *
     * @bodyParam email string required Example: demo@aanigems.com
     */
    public function forgotPassword(Request $request, PasswordResetCodeService $codes): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']], $this->messages());
        $codes->send($data['email']);

        return response()->json(['message' => 'If an account exists for this email, we have sent a 6-digit code. It is valid for 15 minutes.']);
    }

    /**
     * Verify reset code
     *
     * Optional pre-check before showing the new-password form. Counts as an attempt when wrong.
     *
     * @unauthenticated
     *
     * @bodyParam email string required Example: demo@aanigems.com
     * @bodyParam code string required Example: 123456
     */
    public function verifyResetCode(Request $request, PasswordResetCodeService $codes): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email'], 'code' => ['required', 'digits:6']], $this->messages());
        $codes->check($data['email'], $data['code']);

        return response()->json(['message' => 'Code verified.', 'data' => ['valid' => true]]);
    }

    /**
     * Reset password
     *
     * Sets the new password, signs out every device and emails a confirmation.
     *
     * @unauthenticated
     *
     * @bodyParam email string required Example: demo@aanigems.com
     * @bodyParam code string required Example: 123456
     * @bodyParam password string required Example: newsecret123
     * @bodyParam password_confirmation string required Example: newsecret123
     */
    public function resetPassword(Request $request, PasswordResetCodeService $codes): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'digits:6'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ], $this->messages());

        $row = $codes->check($data['email'], $data['code']);
        $user = User::where('email', $row->email)->first();
        if (! $user) {
            throw ValidationException::withMessages(['code' => 'This code is not valid. Please request a new one.']);
        }

        DB::transaction(function () use ($user, $row, $data) {
            $user->forceFill(['password' => $data['password']])->save();
            $row->forceFill(['used_at' => now()])->save();
            $user->tokens()->delete();
        });
        Mail::to($user->email)->queue(new PasswordChangedMail($user));

        return response()->json(['message' => 'Your password has been reset. Please sign in with your new password.']);
    }

    /**
     * Logout (this device)
     *
     * @authenticated
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Signed out.']);
    }

    /**
     * Logout all devices
     *
     * @authenticated
     */
    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'Signed out on all devices.']);
    }

    private function tokenResponse(Request $request, User $user, int $status = 200): JsonResponse
    {
        $platform = $request->attributes->get('platform', 'web');
        $device = Str::limit($request->input('device_name') ?: ($platform === 'web' ? 'Web browser' : 'Mobile app'), 100, '');
        $minutes = (int) config('sanctum.expiration', 43200);
        $expires = $minutes > 0 ? now()->addMinutes($minutes) : null;
        $token = $user->createToken("{$platform}:{$device}", ["platform:{$platform}"], $expires);

        return response()->json(['data' => [
            'user' => new UserResource($user),
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'expires_at' => $expires?->toIso8601String(),
        ]], $status);
    }

    private function isMobile(Request $request): bool
    {
        return $request->attributes->get('platform') === 'mobile';
    }

    private function currencyHint(): ?string
    {
        $c = app(CurrencyService::class)->current();

        return $c === CurrencyService::BASE ? null : $c;
    }

    private function messages(): array
    {
        return [
            'first_name.required' => 'Please enter your first name.',
            'last_name.required' => 'Please enter your last name.',
            'email.required' => 'Please enter your email address.',
            'email.email' => 'Please enter a valid email address.',
            'password.required' => 'Please enter your password.',
            'password.min' => 'Password must be at least 8 characters.',
            'password.confirmed' => 'Passwords do not match.',
            'terms.accepted' => 'Please accept the terms and conditions.',
            'device_name.required' => 'Device name is required.',
            'code.required' => 'Please enter the 6-digit code.',
            'code.digits' => 'The code has 6 digits.',
            'id_token.required' => 'Google sign-in failed. Please try again.',
        ];
    }
}
