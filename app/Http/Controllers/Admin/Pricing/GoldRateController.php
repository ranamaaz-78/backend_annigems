<?php

namespace App\Http\Controllers\Admin\Pricing;

use App\Http\Controllers\Controller;
use App\Models\GoldRate;
use App\Models\Setting;
use App\Services\GoldRateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** @group Admin: Pricing */
class GoldRateController extends Controller
{
    public function __construct(private GoldRateService $gold) {}

    /** Current rate, source, provider status, warning, and history for the chart/table. */
    public function show(Request $request): JsonResponse
    {
        $days = min(365, max(1, $request->integer('days', 30)));
        $history = GoldRate::where('fetched_at', '>=', now()->subDays($days))->orderByDesc('fetched_at')->orderByDesc('id')
            ->limit(500)->get(['id', 'source', 'rate_per_oz', 'fetched_at', 'provider']);

        return response()->json(['data' => [
            'status' => $this->gold->status(),
            'history' => $history,
        ]]);
    }

    /** Update source / manual rate / interval. Switching to api requires a successful fetch first. */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'source' => ['sometimes', 'in:api,manual'],
            'manual_rate_per_oz' => ['sometimes', 'integer', 'min:1'],
            'fetch_interval_minutes' => ['sometimes', 'integer', 'min:5', 'max:10080'],
        ]);
        if (isset($data['manual_rate_per_oz']) && $data['manual_rate_per_oz'] !== (int) Setting::get('gold.manual_rate_per_oz')) {
            $this->gold->setManualRate($data['manual_rate_per_oz']);
        }
        if (isset($data['fetch_interval_minutes'])) {
            Setting::put('gold.fetch_interval_minutes', $data['fetch_interval_minutes']);
        }
        if (isset($data['source'])) {
            $this->gold->setSource($data['source']);
        }
        $this->gold->resetMemo();

        return response()->json(['data' => ['status' => $this->gold->status()], 'message' => 'Gold rate settings saved.']);
    }

    /** "Test & fetch now": calls the provider and stores the rate as the last good API rate. */
    public function fetch(): JsonResponse
    {
        Setting::put('gold.last_attempt_at', now()->toIso8601String());
        $result = $this->gold->fetchFromApi();
        $this->gold->resetMemo();

        return response()->json([
            'data' => ['ok' => $result['ok'], 'error' => $result['error'] ?? null, 'status' => $this->gold->status()],
            'message' => $result['ok'] ? 'Fetched €'.number_format($result['rate']->rate_per_oz / 100, 2).'/oz from the API.' : 'Fetch failed: '.$result['error'],
        ], $result['ok'] ? 200 : 422);
    }
}
