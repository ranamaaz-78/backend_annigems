<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'stripe' => [
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        // Must match the Stripe API version expected by the mobile SDK (PaymentSheet).
        'ephemeral_key_version' => env('STRIPE_EPHEMERAL_KEY_VERSION', '2024-06-20'),
    ],

    'google' => [
        'client_ids' => [
            'web' => env('GOOGLE_CLIENT_ID_WEB'),
            'ios' => env('GOOGLE_CLIENT_ID_IOS'),
            'android' => env('GOOGLE_CLIENT_ID_ANDROID'),
        ],
    ],

    'goldapi' => [
        'key' => env('GOLD_API_KEY'),
        'url' => env('GOLD_API_URL', 'https://www.goldapi.io/api/XAU/EUR'),
    ],

    'fx' => [
        'url' => env('FX_API_URL', 'https://open.er-api.com/v6/latest/EUR'),
    ],

    'storefront' => [
        'url' => rtrim(env('STOREFRONT_URL', 'http://localhost:5173'), '/'),
    ],

    'admin_notify' => env('MAIL_ADMIN_NOTIFY'),

];
