<?php

use App\Models\AdminUser;
use App\Models\User;

return [
    'defaults' => [
        'guard' => env('AUTH_GUARD', 'web'),
        'passwords' => env('AUTH_PASSWORD_BROKER', 'users'),
    ],

    'guards' => [
        // Customers (web storefront + mobile app) authenticate with Sanctum
        // personal access tokens (Bearer). This session guard is kept only
        // because Laravel expects a default guard.
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],
        // Staff (admin SPA): cookie/session auth on the same domain.
        'admin' => [
            'driver' => 'session',
            'provider' => 'admin_users',
        ],
    ],

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => env('AUTH_MODEL', User::class),
        ],
        'admin_users' => [
            'driver' => 'eloquent',
            'model' => AdminUser::class,
        ],
    ],

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => env('AUTH_PASSWORD_RESET_TOKEN_TABLE', 'password_reset_tokens'),
            'expire' => 60,
            'throttle' => 60,
        ],
        'admin_users' => [
            'provider' => 'admin_users',
            'table' => 'admin_password_reset_tokens',
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

    'password_timeout' => env('AUTH_PASSWORD_TIMEOUT', 10800),

    // Minutes of inactivity after which an admin session is logged out.
    'admin_idle_minutes' => (int) env('ADMIN_IDLE_MINUTES', 30),

    // Mandatory TOTP 2FA for staff; only switch off for local development.
    'admin_two_factor' => (bool) env('ADMIN_2FA_ENABLED', true),
];
