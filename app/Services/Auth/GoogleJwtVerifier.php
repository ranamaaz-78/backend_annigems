<?php

namespace App\Services\Auth;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/** Verifies Google ID tokens with Google's public JWKS (cached per Cache-Control max-age). */
class GoogleJwtVerifier implements GoogleTokenVerifier
{
    private const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

    private const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

    public function verify(string $idToken, array $allowedClientIds): array
    {
        $allowed = array_values(array_filter($allowedClientIds));
        if (! $allowed) {
            throw new InvalidGoogleToken('Google sign-in is not configured.');
        }

        try {
            JWT::$leeway = 60;
            $claims = (array) JWT::decode($idToken, JWK::parseKeySet($this->jwks()));
        } catch (Throwable $e) {
            throw new InvalidGoogleToken('Invalid Google token.', previous: $e);
        }

        if (! in_array($claims['iss'] ?? null, self::ISSUERS, true)) {
            throw new InvalidGoogleToken('Invalid Google token issuer.');
        }
        if (! in_array($claims['aud'] ?? null, $allowed, true)) {
            throw new InvalidGoogleToken('This Google token was issued for another app.');
        }
        if (empty($claims['sub']) || empty($claims['email'])) {
            throw new InvalidGoogleToken('Google did not share an email address.');
        }

        return [
            'sub' => (string) $claims['sub'],
            'email' => (string) $claims['email'],
            'email_verified' => filter_var($claims['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'given_name' => $claims['given_name'] ?? null,
            'family_name' => $claims['family_name'] ?? null,
            'picture' => $claims['picture'] ?? null,
        ];
    }

    private function jwks(): array
    {
        $cached = Cache::get('google.jwks');
        if ($cached) {
            return $cached;
        }
        $res = Http::timeout(10)->get(self::JWKS_URL)->throw();
        $ttl = preg_match('/max-age=(\d+)/', (string) $res->header('Cache-Control'), $m) ? (int) $m[1] : 3600;
        Cache::put('google.jwks', $res->json(), $ttl);

        return $res->json();
    }
}
