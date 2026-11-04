<?php

use App\Http\Controllers\Api\StripeWebhookController;
use Illuminate\Support\Facades\Route;

Route::post('stripe', StripeWebhookController::class)->name('stripe');
