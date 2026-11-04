<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Mobile devices
 *
 * Push tokens are stored only; sending comes in a later phase.
 *
 * @authenticated
 */
class DeviceController extends Controller
{
    /**
     * Register push token
     *
     * @bodyParam token string required Example: fcm-or-apns-token
     * @bodyParam platform string required ios or android. Example: ios
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:512'], 'platform' => ['required', 'in:ios,android']]);
        $device = Device::updateOrCreate(['token' => $data['token']], [
            'user_id' => $request->user()->id,
            'platform' => $data['platform'],
            'last_seen_at' => now(),
        ]);

        return response()->json(['data' => ['id' => $device->id, 'platform' => $device->platform]], 201);
    }

    /** Remove push token */
    public function destroy(Request $request, string $token): JsonResponse
    {
        $request->user()->devices()->where('token', $token)->delete();

        return response()->json(['message' => 'Device removed.']);
    }
}
