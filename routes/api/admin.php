<?php

use App\Http\Controllers\Admin;
use Illuminate\Support\Facades\Route;

/*
| Admin SPA API: /api/v1/admin/*
| Session (cookie) auth on the `admin` guard, 2FA-confirmed, permission-checked.
| Loaded with the `web` middleware group (session + CSRF) in bootstrap/app.php.
*/

Route::prefix('auth')->group(function () {
    Route::get('me', [Admin\AuthController::class, 'me']);
    Route::middleware('throttle:admin-login')->group(function () {
        Route::post('login', [Admin\AuthController::class, 'login']);
        Route::post('forgot-password', [Admin\AuthController::class, 'forgotPassword']);
        Route::post('reset-password', [Admin\AuthController::class, 'resetPassword']);
    });
    Route::middleware('admin.auth')->group(function () {
        Route::post('logout', [Admin\AuthController::class, 'logout']);
        Route::post('two-factor/setup', [Admin\AuthController::class, 'setupTwoFactor']);
        Route::post('two-factor/confirm', [Admin\AuthController::class, 'confirmTwoFactor']);
        Route::post('two-factor/challenge', [Admin\AuthController::class, 'challenge'])->middleware('throttle:admin-login');
    });
});

Route::middleware(['admin.auth', 'admin.2fa'])->group(function () {
    Route::put('profile', [Admin\AuthController::class, 'updateProfile']);
    Route::post('profile/recovery-codes', [Admin\AuthController::class, 'regenerateRecoveryCodes']);

    if (file_exists(__DIR__.'/admin_modules.php')) {
        require __DIR__.'/admin_modules.php';
    }
});
