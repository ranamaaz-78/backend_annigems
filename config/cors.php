<?php

return [
    // Storefront (web) and other browser clients call /api/v1/web/* with Bearer tokens.
    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173'))))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 3600,

    // Bearer tokens, not cookies, are used by the storefront.
    'supports_credentials' => false,
];
