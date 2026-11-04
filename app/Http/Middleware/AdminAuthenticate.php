<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Staff session auth for the admin SPA: logged in on the `admin` guard,
 * account active, and not idle for longer than auth.admin_idle_minutes.
 */
class AdminAuthenticate
{
    public function handle(Request $request, Closure $next): Response
    {
        $guard = Auth::guard('admin');
        $user = $guard->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.', 'code' => 'unauthenticated'], 401);
        }

        $idle = config('auth.admin_idle_minutes', 30) * 60;
        $last = $request->session()->get('admin_last_activity');
        if (! $user->is_active || ($last && time() - $last > $idle)) {
            $guard->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json([
                'message' => $user->is_active ? 'Your session expired. Please sign in again.' : 'This staff account is disabled.',
                'code' => 'session_expired',
            ], 401);
        }

        $request->session()->put('admin_last_activity', time());
        Auth::shouldUse('admin');

        return $next($request);
    }
}
