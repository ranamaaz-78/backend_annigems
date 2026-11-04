<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Tags the request with its client platform (web | mobile) from the route prefix. */
class SetPlatform
{
    public function handle(Request $request, Closure $next, string $platform): Response
    {
        $request->attributes->set('platform', $platform);

        return $next($request);
    }
}
