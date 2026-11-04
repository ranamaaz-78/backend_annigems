<?php

use App\Http\Middleware\AdminAuthenticate;
use App\Http\Middleware\EnsureTwoFactorPassed;
use App\Http\Middleware\ResolveCurrency;
use App\Http\Middleware\SetPlatform;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Spatie\Permission\Exceptions\UnauthorizedException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::middleware(['api', 'platform:web', 'currency'])
                ->prefix('api/v1/web')->name('web.')
                ->group(base_path('routes/api/web.php'));
            Route::middleware(['api', 'platform:mobile', 'currency'])
                ->prefix('api/v1/mobile')->name('mobile.')
                ->group(base_path('routes/api/mobile.php'));
            Route::middleware(['web', 'currency'])
                ->prefix('api/v1/admin')->name('admin.')
                ->group(base_path('routes/api/admin.php'));
            Route::middleware('api')
                ->prefix('api/v1/webhooks')->name('webhooks.')
                ->group(base_path('routes/api/webhooks.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin.auth' => AdminAuthenticate::class,
            'admin.2fa' => EnsureTwoFactorPassed::class,
            'currency' => ResolveCurrency::class,
            'platform' => SetPlatform::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
        ]);
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Please sign in to continue.', 'code' => 'unauthenticated'], 401);
            }
        });
        $exceptions->render(function (UnauthorizedException $e, Request $request) {
            return response()->json(['message' => 'You do not have permission to do this.', 'code' => 'forbidden'], 403);
        });
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                $msg = $e->getPrevious() instanceof ModelNotFoundException ? 'Not found.' : ($e->getMessage() ?: 'Not found.');

                return response()->json(['message' => $msg, 'code' => 'not_found'], 404);
            }
        });
    })->create();
