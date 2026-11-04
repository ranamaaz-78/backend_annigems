<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Mail\PasswordChangedMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/**
 * @group Account
 *
 * @authenticated
 */
class AccountController extends Controller
{
    /** Profile */
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    /**
     * Update profile
     *
     * Email change is not supported.
     *
     * @bodyParam first_name string required Example: Priya
     * @bodyParam last_name string required Example: Mehta
     * @bodyParam phone string Example: +91 98765 43210
     * @bodyParam preferred_currency string EUR, USD, INR, AED or GBP. Example: INR
     */
    public function update(Request $request): UserResource
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:80'],
            'last_name' => ['required', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:40'],
            'preferred_currency' => ['nullable', 'string', Rule::exists('currencies', 'code')->where('is_active', true)],
        ], [
            'first_name.required' => 'Please enter your first name.',
            'last_name.required' => 'Please enter your last name.',
            'preferred_currency.exists' => 'This currency is not available.',
        ]);
        $user = $request->user();
        $user->fill($data)->save();

        return new UserResource($user);
    }

    /**
     * Change password
     *
     * `current_password` is required unless a Google-only account sets its first password.
     * Other devices are signed out; this token stays valid.
     *
     * @bodyParam current_password string Example: Demo@1234
     * @bodyParam password string required Example: newsecret123
     * @bodyParam password_confirmation string required Example: newsecret123
     */
    public function password(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => [$user->hasPassword() ? 'required' : 'nullable', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ], [
            'current_password.required' => 'Please enter your current password.',
            'password.min' => 'Password must be at least 8 characters.',
            'password.confirmed' => 'Passwords do not match.',
        ]);

        if ($user->hasPassword() && ! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'Your current password is incorrect.']);
        }

        $user->forceFill(['password' => $data['password']])->save();
        $user->tokens()->whereKeyNot($user->currentAccessToken()->getKey())->delete();
        Mail::to($user->email)->queue(new PasswordChangedMail($user));

        return response()->json(['message' => 'Your password has been updated.']);
    }

    /**
     * Delete account
     *
     * Soft-deletes the account, anonymises personal data and revokes every token. Orders are kept for accounting.
     *
     * @bodyParam password string Required when the account has a password. Example: Demo@1234
     */
    public function destroy(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($user->hasPassword()) {
            $request->validate(['password' => ['required', 'string']], ['password.required' => 'Please confirm with your password.']);
            if (! Hash::check($request->input('password'), $user->password)) {
                throw ValidationException::withMessages(['password' => 'Incorrect password. Please try again.']);
            }
        }

        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            $user->addresses()->forceDelete();
            $user->wishlistProducts()->detach();
            $user->devices()->delete();
            $user->forceFill([
                'first_name' => 'Deleted',
                'last_name' => 'Customer',
                'email' => "deleted+{$user->id}@deleted.invalid",
                'password' => null,
                'google_id' => null,
                'avatar_url' => null,
                'phone' => null,
                'is_active' => false,
                'remember_token' => null,
            ])->save();
            $user->delete();
        });

        return response()->json(['message' => 'Your account has been deleted.']);
    }
}
