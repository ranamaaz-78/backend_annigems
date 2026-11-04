<?php

namespace App\Docs;

use Knuckles\Camel\Extraction\ExtractedEndpointData;
use Knuckles\Scribe\Extracting\Strategies\Strategy;

/**
 * Scribe metadata strategy: splits the docs into Web / Mobile / Admin / Webhooks
 * groups by URL prefix (web and mobile share controllers, so the docblock
 *
 * @group alone would merge them) and marks Bearer-protected routes as authenticated.
 */
class PlatformGroups extends Strategy
{
    public function __invoke(ExtractedEndpointData $endpointData, array $settings = []): ?array
    {
        $uri = $endpointData->uri;
        $group = preg_replace('/^Admin:\s*/', '', $endpointData->metadata->groupName ?: 'Endpoints');
        $middleware = $endpointData->route->gatherMiddleware();

        $prefix = match (true) {
            str_starts_with($uri, 'api/v1/web/') => 'Web',
            str_starts_with($uri, 'api/v1/mobile/') => 'Mobile',
            str_starts_with($uri, 'api/v1/admin/') => 'Admin',
            str_starts_with($uri, 'api/v1/webhooks/') => 'Webhooks',
            default => null,
        };
        if (! $prefix) {
            return null;
        }

        $out = ['groupName' => $prefix === 'Webhooks' ? 'Webhooks' : "{$prefix} · {$group}"];
        if (in_array('auth:sanctum', $middleware, true)) {
            $out['authenticated'] = true;
        } elseif ($prefix === 'Admin') {
            // Admin uses the session cookie of the admin SPA, not a Bearer token.
            $out['authenticated'] = false;
            $out['description'] = trim(($endpointData->metadata->description ?? '')."\n\nAdmin SPA endpoint: session cookie + `X-XSRF-TOKEN`, 2FA-confirmed staff with the required permission.");
        } else {
            $out['authenticated'] = false;
        }

        return $out;
    }
}
