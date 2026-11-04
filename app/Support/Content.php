<?php

namespace App\Support;

use App\Models\ContentBlock;

class Content
{
    private const IMAGE_KEYS = ['image', 'logo', 'icon_image', 'background'];

    /** Content block value with image paths turned into absolute URLs. */
    public static function get(string $key, mixed $default = null): mixed
    {
        return static::present(ContentBlock::value($key, $default));
    }

    public static function present(mixed $value, ?string $key = null): mixed
    {
        if (is_array($value)) {
            $out = [];
            foreach ($value as $k => $v) {
                $out[$k] = static::present($v, is_string($k) ? $k : $key);
            }

            return $out;
        }
        if (is_string($value) && ((in_array($key, self::IMAGE_KEYS, true) && $value !== '') || preg_match('#^(images|uploads)/#', $value))) {
            return Media::url($value);
        }

        return $value;
    }
}
