<?php

/* Mobile app API: /api/v1/mobile/* (bootstrap adds `app`; checkout adds PaymentSheet keys). */

use App\Http\Controllers\Api;
use Illuminate\Support\Facades\Route;

require __DIR__.'/shared.php';

Route::middleware(['auth:sanctum', 'customer'])->group(function () {
    Route::post('devices', [Api\DeviceController::class, 'store']);
    Route::delete('devices/{token}', [Api\DeviceController::class, 'destroy'])->where('token', '.*');
});
