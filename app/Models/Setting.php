<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/** Key/value settings (json values), cached per request lifecycle. */
class Setting extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['value' => 'json'];

    private static ?array $memo = null;

    public static function get(string $key, mixed $default = null): mixed
    {
        $all = static::allCached();

        return array_key_exists($key, $all) ? $all[$key] : $default;
    }

    public static function put(string $key, mixed $value): void
    {
        $old = static::get($key);
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        static::flush();
        if ($old !== $value && auth('admin')->check()) {
            activity('settings')->causedBy(auth('admin')->user())
                ->withProperties(['key' => $key, 'old' => $old, 'new' => $value])->log("Setting {$key} changed");
        }
    }

    public static function allCached(): array
    {
        return static::$memo ??= Cache::rememberForever('settings.all', fn () => static::query()->pluck('value', 'key')->all());
    }

    public static function flush(): void
    {
        static::$memo = null;
        Cache::forget('settings.all');
    }
}
