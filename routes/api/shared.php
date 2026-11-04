<?php

/*
| Endpoints shared by /api/v1/web and /api/v1/mobile (same controllers and services).
| Included from routes/api/web.php and routes/api/mobile.php.
*/

use App\Http\Controllers\Api;
use Illuminate\Support\Facades\Route;

// Store / content (public)
Route::get('bootstrap', [Api\StoreController::class, 'bootstrap']);
Route::get('home', [Api\StoreController::class, 'home']);
Route::get('categories', [Api\CatalogController::class, 'categories']);
Route::get('products', [Api\CatalogController::class, 'products']);
Route::get('products/{slugOrLegacyId}', [Api\CatalogController::class, 'show']);
Route::get('search', [Api\CatalogController::class, 'search']);
Route::get('configurator', [Api\ConfiguratorController::class, 'show']);
Route::post('configurator/price', [Api\ConfiguratorController::class, 'price']);
Route::post('cart/quote', [Api\CartController::class, 'quote'])->middleware('throttle:coupon');
Route::get('pages/{slug}', [Api\ContentController::class, 'page']);
Route::get('faqs', [Api\ContentController::class, 'faqs']);
Route::get('about', [Api\ContentController::class, 'about']);
Route::get('services', [Api\ContentController::class, 'services']);
Route::post('contact', [Api\FormsController::class, 'contact'])->middleware('throttle:forms');
Route::post('newsletter', [Api\FormsController::class, 'newsletter'])->middleware('throttle:forms');

if (file_exists(__DIR__.'/shared_account.php')) {
    require __DIR__.'/shared_account.php';
}
