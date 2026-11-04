<?php

use App\Http\Controllers\Api;
use Illuminate\Support\Facades\Route;

// Auth
Route::prefix('auth')->group(function () {
    Route::middleware('throttle:auth')->group(function () {
        Route::post('register', [Api\AuthController::class, 'register']);
        Route::post('login', [Api\AuthController::class, 'login']);
        Route::post('google', [Api\AuthController::class, 'google']);
        Route::post('forgot-password', [Api\AuthController::class, 'forgotPassword']);
        Route::post('verify-reset-code', [Api\AuthController::class, 'verifyResetCode']);
        Route::post('reset-password', [Api\AuthController::class, 'resetPassword']);
    });
    Route::middleware(['auth:sanctum', 'customer'])->group(function () {
        Route::post('logout', [Api\AuthController::class, 'logout']);
        Route::post('logout-all', [Api\AuthController::class, 'logoutAll']);
    });
});

// Account 🔒
Route::middleware(['auth:sanctum', 'customer'])->group(function () {
    Route::get('me', [Api\AccountController::class, 'show']);
    Route::put('me', [Api\AccountController::class, 'update']);
    Route::put('me/password', [Api\AccountController::class, 'password']);
    Route::delete('me', [Api\AccountController::class, 'destroy']);

    Route::get('me/addresses', [Api\AddressController::class, 'index']);
    Route::post('me/addresses', [Api\AddressController::class, 'store']);
    Route::put('me/addresses/{id}', [Api\AddressController::class, 'update'])->whereNumber('id');
    Route::delete('me/addresses/{id}', [Api\AddressController::class, 'destroy'])->whereNumber('id');
    Route::post('me/addresses/{id}/default', [Api\AddressController::class, 'setDefault'])->whereNumber('id');

    Route::get('wishlist', [Api\WishlistController::class, 'index']);
    Route::post('wishlist/sync', [Api\WishlistController::class, 'sync']);
    Route::post('wishlist/{productId}', [Api\WishlistController::class, 'store']);
    Route::delete('wishlist/{productId}', [Api\WishlistController::class, 'destroy']);

    if (file_exists(__DIR__.'/shared_orders.php')) {
        require __DIR__.'/shared_orders.php';
    }
});
