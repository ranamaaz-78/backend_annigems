<?php

namespace App\Http\Controllers\Admin\Pricing;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Models\Setting;
use App\Services\CurrencyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** @group Admin: Pricing */
class CurrencyController extends Controller
{
    public function __construct(private CurrencyService $fx) {}

    public function index(): JsonResponse
    {
        $this->fx->resetMemo();
        $rows = Currency::orderBy('sort_order')->get()->map(function (Currency $c) {
            $manual = $this->fx->latestRate($c->code, 'manual');
            $api = $this->fx->latestRate($c->code, 'api');

            return $c->toArray() + [
                'manual_rate' => $c->is_base ? 1.0 : ($manual ? (float) $manual->rate : null),
                'manual_updated_at' => $manual?->fetched_at?->toIso8601String(),
                'api_rate' => $c->is_base ? 1.0 : ($api ? (float) $api->rate : null),
                'api_fetched_at' => $api?->fetched_at?->toIso8601String(),
                'rate_in_use' => $c->is_base ? 1.0 : rescue(fn () => $this->fx->rate($c->code), null, false),
            ];
        });

        return response()->json(['data' => ['currencies' => $rows, 'status' => $this->fx->status()]]);
    }

    /** Toggle a currency and/or set its manual rate. */
    public function update(Request $request, string $code): JsonResponse
    {
        $currency = Currency::where('code', strtoupper($code))->firstOrFail();
        $data = $request->validate([
            'is_active' => ['sometimes', 'boolean'],
            'manual_rate' => ['sometimes', 'numeric', 'gt:0', 'max:1000000'],
            'symbol' => ['sometimes', 'string', 'max:8'],
            'sort_order' => ['sometimes', 'integer'],
        ]);
        if ($currency->is_base && (($data['is_active'] ?? true) === false || isset($data['manual_rate']))) {
            throw ValidationException::withMessages(['code' => 'EUR is the base currency: it is always active with rate 1.']);
        }
        $currency->fill(collect($data)->only(['is_active', 'symbol', 'sort_order'])->all())->save();
        if (isset($data['manual_rate'])) {
            $this->fx->setManualRate($currency->code, (float) $data['manual_rate']);
        }

        return $this->index();
    }

    public function settings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'source' => ['sometimes', 'in:api,manual'],
            'fetch_interval_minutes' => ['sometimes', 'integer', 'min:15', 'max:10080'],
        ]);
        if (isset($data['fetch_interval_minutes'])) {
            Setting::put('fx.fetch_interval_minutes', $data['fetch_interval_minutes']);
        }
        if (isset($data['source'])) {
            $this->fx->setSource($data['source']);
        }

        return $this->index();
    }

    public function fetch(): JsonResponse
    {
        Setting::put('fx.last_attempt_at', now()->toIso8601String());
        $result = $this->fx->fetchFromApi();
        $res = $this->index();
        $payload = $res->getData(true) + ['message' => $result['ok'] ? 'Exchange rates fetched.' : 'Fetch failed: '.$result['error']];

        return response()->json($payload, $result['ok'] ? 200 : 422);
    }
}
