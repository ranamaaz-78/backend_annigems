<?php

use App\Http\Controllers\Admin;
use Illuminate\Support\Facades\Route;

$perm = fn (string $p) => "permission:{$p},admin";

// Content (CMS)
Route::middleware($perm('content.manage'))->prefix('content')->group(function () {
    Route::get('blocks', [Admin\Content\ContentBlockController::class, 'index']);
    Route::get('blocks/{key}', [Admin\Content\ContentBlockController::class, 'show']);
    Route::put('blocks/{key}', [Admin\Content\ContentBlockController::class, 'update']);
    Route::apiResource('pages', Admin\Content\PageController::class)->whereNumber('page');
    Route::get('faqs', [Admin\Content\FaqController::class, 'index']);
    Route::post('faqs', [Admin\Content\FaqController::class, 'store']);
    Route::put('faqs/{id}', [Admin\Content\FaqController::class, 'update'])->whereNumber('id');
    Route::delete('faqs/{id}', [Admin\Content\FaqController::class, 'destroy'])->whereNumber('id');
    Route::post('faqs/reorder', [Admin\Content\FaqController::class, 'reorder']);
    Route::post('faq-categories', [Admin\Content\FaqController::class, 'storeCategory']);
    Route::put('faq-categories/{id}', [Admin\Content\FaqController::class, 'updateCategory'])->whereNumber('id');
    Route::delete('faq-categories/{id}', [Admin\Content\FaqController::class, 'destroyCategory'])->whereNumber('id');
    Route::apiResource('testimonials', Admin\Content\TestimonialController::class)->whereNumber('testimonial');
});

// Size guide blocks are also editable by configurator managers.
Route::middleware($perm('configurator.manage|content.manage'))->group(function () {
    Route::get('configurator/size-guide/{key}', [Admin\Content\ContentBlockController::class, 'show'])->where('key', 'configurator\.(size_chart|size_guide_steps|steps)');
    Route::put('configurator/size-guide/{key}', [Admin\Content\ContentBlockController::class, 'update'])->where('key', 'configurator\.(size_chart|size_guide_steps|steps)');
});

// Messages
Route::middleware($perm('messages.manage'))->group(function () {
    Route::get('messages', [Admin\Content\MessageController::class, 'index']);
    Route::get('messages/{id}', [Admin\Content\MessageController::class, 'show'])->whereNumber('id');
    Route::put('messages/{id}', [Admin\Content\MessageController::class, 'update'])->whereNumber('id');
    Route::post('messages/{id}/reply', [Admin\Content\MessageController::class, 'reply'])->whereNumber('id');
    Route::delete('messages/{id}', [Admin\Content\MessageController::class, 'destroy'])->whereNumber('id');
    Route::get('newsletter', [Admin\Content\MessageController::class, 'subscribers']);
    Route::get('newsletter-export', [Admin\Content\MessageController::class, 'exportSubscribers']);
    Route::post('newsletter/{id}/unsubscribe', [Admin\Content\MessageController::class, 'unsubscribe'])->whereNumber('id');
    Route::delete('newsletter/{id}', [Admin\Content\MessageController::class, 'destroySubscriber'])->whereNumber('id');
});

// Staff & roles (Super Admin)
Route::middleware($perm('staff.manage'))->group(function () {
    Route::get('staff', [Admin\System\StaffController::class, 'index']);
    Route::post('staff', [Admin\System\StaffController::class, 'store']);
    Route::put('staff/{id}', [Admin\System\StaffController::class, 'update'])->whereNumber('id');
    Route::delete('staff/{id}', [Admin\System\StaffController::class, 'destroy'])->whereNumber('id');
    Route::post('staff/{id}/reset-2fa', [Admin\System\StaffController::class, 'resetTwoFactor'])->whereNumber('id');
    Route::post('staff/{id}/password-reset', [Admin\System\StaffController::class, 'sendPasswordReset'])->whereNumber('id');
    Route::get('roles', [Admin\System\RoleController::class, 'index']);
    Route::post('roles', [Admin\System\RoleController::class, 'store']);
    Route::put('roles/{id}', [Admin\System\RoleController::class, 'update'])->whereNumber('id');
    Route::delete('roles/{id}', [Admin\System\RoleController::class, 'destroy'])->whereNumber('id');
});

Route::get('activity', [Admin\System\ActivityController::class, 'index'])->middleware($perm('activity.view'));

Route::middleware($perm('settings.manage'))->group(function () {
    Route::get('settings', [Admin\System\AppSettingsController::class, 'show']);
    Route::put('settings', [Admin\System\AppSettingsController::class, 'update']);
});
