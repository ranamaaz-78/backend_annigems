<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * 2FA is mandatory for every staff user: first force setup, then require the
 * TOTP (or recovery code) challenge for this session. Skipped entirely when
 * ADMIN_2FA_ENABLED=false (local development only).
 */
class EnsureTwoFactorPassed
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('auth.admin_two_factor')) {
            return $next($request);
        }

        $user = $request->user('admin');

        if (! $user->hasTwoFactorEnabled()) {
            return response()->json([
                'message' => 'Set up two-factor authentication to continue.',
                'code' => 'two_factor_setup_required',
            ], 403);
        }

        if (! $request->session()->get('admin_2fa_passed')) {
            return response()->json([
                'message' => 'Enter your two-factor code to continue.',
                'code' => 'two_factor_challenge_required',
            ], 403);
        }

        return $next($request);
    }
}
