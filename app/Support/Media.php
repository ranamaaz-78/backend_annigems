<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class Media
{
    /** DB stores paths relative to the public disk ("images/x.jpg"); APIs return absolute URLs. */
    public static function url(?string $path): ?string
    {
        if (! $path) {
            return null;
        }
        if (preg_match('#^https?://#', $path)) {
            return $path;
        }

        return Storage::disk('public')->url(ltrim(preg_replace('#^/?storage/#', '', $path), '/'));
    }

    /** Normalise a seed/storefront path ("/images/x.jpg") to a disk path ("images/x.jpg"). */
    public static function normalize(?string $path): ?string
    {
        if (! $path) {
            return null;
        }
        if (preg_match('#^https?://#', $path)) {
            return $path;
        }

        return ltrim(preg_replace('#^/?storage/#', '', $path), '/');
    }
}
