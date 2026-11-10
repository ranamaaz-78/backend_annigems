<?php

/*
| Admin B2B module: /api/v1/admin/b2b/* (inside admin.auth + admin.2fa).
| b2b.view = see everything, b2b.sales = sales person (own businesses only, see App\Support\B2bScope),
| b2b.manage = sales persons, tiers, all businesses, b2b.orders = approve/reject, b2b.payouts = payouts.
*/

use App\Http\Controllers\Admin\B2b;
use Illuminate\Support\Facades\Route;

$perm = fn (string $p) => "permission:{$p},admin";

Route::prefix('b2b')->group(function () use ($perm) {
    Route::middleware($perm('b2b.view|b2b.sales|b2b.manage'))->group(function () {
        Route::get('dashboard', B2b\DashboardController::class);
        Route::get('tiers', [B2b\TierController::class, 'index']);
        Route::get('businesses', [B2b\BusinessController::class, 'index']);
        Route::get('businesses/{id}', [B2b\BusinessController::class, 'show'])->whereNumber('id');
        Route::get('orders', [B2b\OrderController::class, 'index']);
        Route::get('orders/{number}', [B2b\OrderController::class, 'show']);
        Route::get('commissions', [B2b\CommissionController::class, 'index']);
        Route::get('payouts', [B2b\PayoutController::class, 'index']);
    });

    // Onboarding: sales persons (own businesses) and B2B managers.
    Route::middleware($perm('b2b.sales|b2b.manage'))->group(function () {
        Route::post('businesses', [B2b\BusinessController::class, 'store']);
        Route::put('businesses/{id}', [B2b\BusinessController::class, 'update'])->whereNumber('id');
    });

    Route::middleware($perm('b2b.view|b2b.manage|b2b.payouts'))->group(function () {
        Route::get('sales-reps', [B2b\SalesRepController::class, 'index']);
        Route::get('sales-reps-options', [B2b\SalesRepController::class, 'options']);
        Route::get('sales-reps/{id}', [B2b\SalesRepController::class, 'show'])->whereNumber('id');
    });

    Route::middleware($perm('b2b.manage'))->group(function () {
        Route::post('sales-reps', [B2b\SalesRepController::class, 'store']);
        Route::put('sales-reps/{id}', [B2b\SalesRepController::class, 'update'])->whereNumber('id');
        Route::post('tiers', [B2b\TierController::class, 'store']);
        Route::put('tiers/{id}', [B2b\TierController::class, 'update'])->whereNumber('id');
        Route::delete('tiers/{id}', [B2b\TierController::class, 'destroy'])->whereNumber('id');
        Route::put('tiers/{id}/discounts', [B2b\TierController::class, 'discounts'])->whereNumber('id');
    });

    Route::middleware($perm('b2b.orders'))->group(function () {
        Route::post('orders/{number}/approve', [B2b\OrderController::class, 'approve']);
        Route::post('orders/{number}/reject', [B2b\OrderController::class, 'reject']);
        Route::post('orders/{number}/cancel', [B2b\OrderController::class, 'cancel']);
    });

    Route::middleware($perm('b2b.payouts'))->group(function () {
        Route::post('payouts', [B2b\PayoutController::class, 'store']);
        Route::delete('payouts/{id}', [B2b\PayoutController::class, 'destroy'])->whereNumber('id');
    });
});
