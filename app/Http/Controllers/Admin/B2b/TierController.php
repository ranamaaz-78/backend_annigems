<?php

namespace App\Http\Controllers\Admin\B2b;

use App\Http\Controllers\Controller;
use App\Models\B2bTier;
use App\Models\B2bTierDiscount;
use App\Models\Category;
use App\Models\Country;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Membership tiers and their discount matrix: one % per category plus the Design Your Ring row
 * (category_id null). A category without a row has 0%. New percentages apply to new prices and
 * orders only; placed orders keep their prices.
 *
 * @group Admin: B2B
 */
class TierController extends Controller
{
    public function index(): JsonResponse
    {
        $tiers = B2bTier::with('discounts')->withCount('businesses')->orderBy('sort_order')->orderBy('id')->get();

        return response()->json(['data' => [
            'tiers' => $tiers->map(fn (B2bTier $t) => $this->row($t)),
            'categories' => Category::orderBy('sort_order')->orderBy('name')->get(['id', 'name', 'is_active']),
            // For the onboarding address (sales persons have no access to the pricing screens).
            'countries' => Country::where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(['code', 'name']),
        ]]);
    }

    private function row(B2bTier $t): array
    {
        return [
            'id' => $t->id,
            'name' => $t->name,
            'sort_order' => $t->sort_order,
            'is_active' => $t->is_active,
            'businesses_count' => (int) ($t->businesses_count ?? $t->businesses()->count()),
            // {"ring": 25, "3": 40, ...}: category id (or "ring" for Design Your Ring) => percent
            'discounts' => (object) $t->discounts->mapWithKeys(fn (B2bTierDiscount $d) => [$d->category_id === null ? 'ring' : (string) $d->category_id => (float) $d->percent])->all(),
        ];
    }

    private function rules(?B2bTier $t = null): array
    {
        return [
            'name' => ['required', 'string', 'max:60', Rule::unique('b2b_tiers', 'name')->ignore($t?->id)],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $tier = B2bTier::create($request->validate($this->rules()) + ['sort_order' => (int) B2bTier::max('sort_order') + 1]);

        return response()->json(['data' => $this->row($tier->load('discounts')), 'message' => 'Tier created.'], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $tier = B2bTier::findOrFail($id);
        $tier->update($request->validate($this->rules($tier)));

        return response()->json(['data' => $this->row($tier->load('discounts')), 'message' => 'Saved.']);
    }

    public function destroy(int $id): JsonResponse
    {
        $tier = B2bTier::withCount('businesses')->findOrFail($id);
        if ($tier->businesses_count > 0) {
            throw ValidationException::withMessages(['tier' => 'Move the '.$tier->businesses_count.' business(es) on this tier to another tier first.']);
        }
        $tier->delete();

        return response()->json(['message' => 'Tier deleted.']);
    }

    /**
     * Save the discount matrix of a tier.
     *
     * @bodyParam discounts object[] required [{category_id: 3, percent: 40}, {category_id: null, percent: 25}] (null = Design Your Ring)
     */
    public function discounts(Request $request, int $id): JsonResponse
    {
        $tier = B2bTier::findOrFail($id);
        $data = $request->validate([
            'discounts' => ['present', 'array'],
            'discounts.*.category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'discounts.*.percent' => ['required', 'numeric', 'min:0', 'max:100'],
        ], ['discounts.*.percent.max' => 'A discount cannot be more than 100%.']);

        DB::transaction(function () use ($tier, $data) {
            foreach ($data['discounts'] as $row) {
                B2bTierDiscount::updateOrCreate(
                    ['tier_id' => $tier->id, 'category_id' => $row['category_id'] ?? null],
                    ['percent' => round((float) $row['percent'], 2)],
                );
            }
        });
        activity('b2b')->causedBy($request->user('admin'))->performedOn($tier)->withProperties(['discounts' => $data['discounts']])->log('Tier discounts saved');

        return response()->json(['data' => $this->row($tier->fresh('discounts')), 'message' => 'Discounts saved.']);
    }
}
