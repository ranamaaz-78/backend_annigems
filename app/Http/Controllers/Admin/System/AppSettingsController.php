<?php

namespace App\Http\Controllers\Admin\System;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Admin: App settings
 *
 * Store name/emails, mobile app versions, maintenance flag. Secrets (Stripe, Google, provider keys) live only in .env.
 */
class AppSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->values()]);
    }

    public function update(Request $request): JsonResponse
    {
        $v = '/^\d+\.\d+\.\d+$/';
        $data = $request->validate([
            'store_name' => ['required', 'string', 'max:120'],
            'support_email' => ['required', 'email'],
            'notify_email' => ['nullable', 'email'],
            'mobile.ios.min_version' => ['required', "regex:{$v}"],
            'mobile.ios.latest_version' => ['required', "regex:{$v}"],
            'mobile.ios.force_update' => ['boolean'],
            'mobile.android.min_version' => ['required', "regex:{$v}"],
            'mobile.android.latest_version' => ['required', "regex:{$v}"],
            'mobile.android.force_update' => ['boolean'],
            'maintenance.enabled' => ['boolean'],
            'maintenance.message' => ['nullable', 'string', 'max:500'],
        ], ['regex' => 'Use a version like 1.2.0.']);

        Setting::put('app.store_name', $data['store_name']);
        Setting::put('app.support_email', $data['support_email']);
        Setting::put('app.notify_email', $data['notify_email'] ?? null);
        Setting::put('app.mobile', [
            'ios' => ['min_version' => $data['mobile']['ios']['min_version'], 'latest_version' => $data['mobile']['ios']['latest_version'], 'force_update' => (bool) ($data['mobile']['ios']['force_update'] ?? false)],
            'android' => ['min_version' => $data['mobile']['android']['min_version'], 'latest_version' => $data['mobile']['android']['latest_version'], 'force_update' => (bool) ($data['mobile']['android']['force_update'] ?? false)],
        ]);
        Setting::put('app.maintenance', ['enabled' => (bool) ($data['maintenance']['enabled'] ?? false), 'message' => $data['maintenance']['message'] ?? '']);

        return response()->json(['data' => $this->values(), 'message' => 'Settings saved.']);
    }

    private function values(): array
    {
        return [
            'store_name' => Setting::get('app.store_name', config('app.name')),
            'support_email' => Setting::get('app.support_email'),
            'notify_email' => Setting::get('app.notify_email'),
            'mobile' => Setting::get('app.mobile'),
            'maintenance' => Setting::get('app.maintenance', ['enabled' => false, 'message' => '']),
            'stripe_mode' => str_starts_with((string) config('services.stripe.secret'), 'sk_live') ? 'live' : 'test',
            'stripe_configured' => (bool) config('services.stripe.secret') && config('services.stripe.secret') !== 'sk_test_xxx',
            'webhook_configured' => (bool) config('services.stripe.webhook_secret') && config('services.stripe.webhook_secret') !== 'whsec_xxx',
            'google_configured' => array_map(fn ($v) => (bool) $v, config('services.google.client_ids')),
            'gold_api_key_configured' => (bool) config('services.goldapi.key'),
            'storefront_url' => config('services.storefront.url'),
        ];
    }
}
