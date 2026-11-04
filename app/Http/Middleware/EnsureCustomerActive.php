<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Customer Bearer token must belong to an active, non-deleted customer. */
class EnsureCustomerActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Please sign in to continue.', 'code' => 'unauthenticated'], 401);
        }
        if (! $user->is_active || $user->trashed()) {
            $user->currentAccessToken()?->delete();

            return response()->json(['message' => 'This account is disabled. Please contact us.', 'code' => 'account_disabled'], 401);
        }

        return $next($request);
    }
}
