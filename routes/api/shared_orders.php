<?php

use App\Http\Controllers\Api;
use Illuminate\Support\Facades\Route;

// Checkout & orders 🔒 (inside the auth:sanctum + customer group)
Route::post('checkout', [Api\OrderController::class, 'checkout'])->middleware('throttle:checkout');
Route::get('orders', [Api\OrderController::class, 'index']);
Route::get('orders/{number}', [Api\OrderController::class, 'show']);
Route::post('orders/{number}/pay', [Api\OrderController::class, 'pay'])->middleware('throttle:checkout');
Route::post('orders/{number}/cancel', [Api\OrderController::class, 'cancel']);
Route::post('orders/{number}/reorder', [Api\OrderController::class, 'reorder']);
