<?php

namespace App\Services;

use App\Models\Setting;

class AdminNotify
{
    /** Staff notification address: app setting, else MAIL_ADMIN_NOTIFY. */
    public static function address(): ?string
    {
        return Setting::get('app.notify_email') ?: config('services.admin_notify');
    }
}
