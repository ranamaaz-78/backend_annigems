<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect('/admin'));

// Admin SPA (React). Every /admin/* path mounts the same view.
Route::view('/admin/{any?}', 'admin')->where('any', '.*')->name('admin.spa');
