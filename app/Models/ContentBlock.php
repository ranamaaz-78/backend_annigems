<?php

namespace App\Models;

use App\Models\Concerns\LogsChanges;
use Illuminate\Database\Eloquent\Model;

class ContentBlock extends Model
{
    use LogsChanges;

    protected string $activityLogName = 'content';

    protected $guarded = ['id'];

    protected $casts = ['value' => 'json'];

    private static array $memo = [];

    public static function value(string $key, mixed $default = null): mixed
    {
        if (! array_key_exists($key, static::$memo)) {
            static::$memo[$key] = static::where('key', $key)->value('value');
        }
        $v = static::$memo[$key];

        return $v === null ? $default : (is_string($v) ? json_decode($v, true) : $v);
    }

    public static function flushMemo(): void
    {
        static::$memo = [];
    }

    protected static function booted(): void
    {
        static::saved(fn () => static::flushMemo());
    }
}
