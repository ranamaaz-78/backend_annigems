<?php

namespace App\Services\Auth;

interface GoogleTokenVerifier
{
    /**
     * Verifies a Google ID token against the allowed client ids.
     *
     * @param  string[]  $allowedClientIds
     * @return array{sub: string, email: string, email_verified: bool, given_name: ?string, family_name: ?string, picture: ?string}
     *
     * @throws InvalidGoogleToken
     */
    public function verify(string $idToken, array $allowedClientIds): array;
}
