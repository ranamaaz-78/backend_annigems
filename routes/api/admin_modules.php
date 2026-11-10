<?php

/*
| Admin modules (inside admin.auth + admin.2fa). Every group is permission-checked;
| the React UI hides what the staff user cannot do.
*/

use App\Http\Controllers\Admin;
use Illuminate\Support\Facades\Route;

$perm = fn (string $p) => "permission:{$p},admin";

Route::get('dashboard', Admin\DashboardController::class)->middleware($perm('dashboard.view'));
Route::post('media', [Admin\MediaController::class, 'store'])
    ->middleware($perm('media.upload|catalog.manage|configurator.manage|content.manage'));

// Orders
Route::middleware($perm('orders.view'))->group(function () {
    Route::get('orders', [Admin\OrderController::class, 'index']);
    Route::get('orders-export', [Admin\OrderController::class, 'export']);
    Route::get('orders/{number}', [Admin\OrderController::class, 'show']);
    Route::get('orders/{number}/{type}', [Admin\OrderController::class, 'document'])->where('type', 'invoice|packing-slip');
});
Route::middleware($perm('orders.stage'))->group(function () {
    Route::post('orders/{number}/stage', [Admin\OrderController::class, 'stage']);
    Route::put('orders/{number}/tracking', [Admin\OrderController::class, 'tracking']);
});
Route::middleware($perm('orders.manage'))->group(function () {
    Route::post('orders/{number}/cancel', [Admin\OrderController::class, 'cancel']);
    Route::post('orders/{number}/resend-confirmation', [Admin\OrderController::class, 'resendConfirmation']);
    Route::post('orders/{number}/notes', [Admin\OrderController::class, 'addNote']);
});
Route::post('orders/{number}/refund', [Admin\OrderController::class, 'refund'])->middleware($perm('orders.refund'));

// Customers
Route::middleware($perm('customers.view'))->group(function () {
    Route::get('customers', [Admin\CustomerController::class, 'index']);
    Route::get('customers/{id}', [Admin\CustomerController::class, 'show'])->whereNumber('id');
});
Route::middleware($perm('customers.manage'))->group(function () {
    Route::put('customers/{id}/active', [Admin\CustomerController::class, 'setActive'])->whereNumber('id');
    Route::post('customers/{id}/reset-code', [Admin\CustomerController::class, 'sendResetCode'])->whereNumber('id');
});

// Catalog
Route::middleware($perm('catalog.manage'))->group(function () {
    Route::get('products-options', [Admin\Catalog\ProductController::class, 'options']);
    Route::post('products-reorder', [Admin\Catalog\ProductController::class, 'reorder']);
    Route::apiResource('products', Admin\Catalog\ProductController::class)->whereNumber('product');
    Route::apiResource('categories', Admin\Catalog\CategoryController::class)->whereNumber('category');
    Route::apiResource('reviews', Admin\Catalog\ReviewController::class)->whereNumber('review');
});

// Design Your Ring
Route::middleware($perm('configurator.manage'))->prefix('configurator')->group(function () {
    Route::apiResource('rings', Admin\Configurator\RingController::class)->whereNumber('ring');
    Route::apiResource('stones', Admin\Configurator\StoneController::class)->whereNumber('stone');
    Route::get('combos', [Admin\Configurator\ComboController::class, 'index']);
    Route::put('combos', [Admin\Configurator\ComboController::class, 'upsert']);
    Route::post('price-preview', [Admin\Configurator\ComboController::class, 'preview']);
});

// Pricing & settings
Route::middleware($perm('pricing.manage'))->prefix('pricing')->group(function () {
    Route::get('gold', [Admin\Pricing\GoldRateController::class, 'show']);
    Route::put('gold', [Admin\Pricing\GoldRateController::class, 'update']);
    Route::post('gold/fetch', [Admin\Pricing\GoldRateController::class, 'fetch']);
    Route::get('currencies', [Admin\Pricing\CurrencyController::class, 'index']);
    Route::put('currencies/settings', [Admin\Pricing\CurrencyController::class, 'settings']);
    Route::post('currencies/fetch', [Admin\Pricing\CurrencyController::class, 'fetch']);
    Route::put('currencies/{code}', [Admin\Pricing\CurrencyController::class, 'update'])->where('code', '[A-Za-z]{3}');
    Route::get('commerce', [Admin\Pricing\CommerceSettingsController::class, 'show']);
    Route::put('commerce', [Admin\Pricing\CommerceSettingsController::class, 'update']);
    Route::apiResource('shipping-methods', Admin\Pricing\ShippingMethodController::class)->whereNumber('shipping_method');
    Route::apiResource('countries', Admin\Pricing\CountryController::class)->whereNumber('country');
});

// Coupons
Route::middleware($perm('coupons.manage'))->group(function () {
    Route::apiResource('coupons', Admin\CouponController::class)->whereNumber('coupon');
});

require __DIR__.'/admin_b2b.php';

if (file_exists(__DIR__.'/admin_content.php')) {
    require __DIR__.'/admin_content.php';
}
