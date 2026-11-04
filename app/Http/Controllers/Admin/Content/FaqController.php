<?php

namespace App\Http\Controllers\Admin\Content;

use App\Http\Controllers\Controller;
use App\Models\Faq;
use App\Models\FaqCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** @group Admin: Content */
class FaqController extends Controller
{
    /** Categories with all their items (active and inactive), in order. */
    public function index(): JsonResponse
    {
        return response()->json(['data' => FaqCategory::with('faqs')->orderBy('sort_order')->orderBy('id')->get()]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        FaqCategory::create($data + ['sort_order' => (int) FaqCategory::max('sort_order') + 1]);

        return $this->index();
    }

    public function updateCategory(Request $request, int $id): JsonResponse
    {
        FaqCategory::findOrFail($id)->update($request->validate(['name' => ['required', 'string', 'max:120']]));

        return $this->index();
    }

    public function destroyCategory(int $id): JsonResponse
    {
        FaqCategory::findOrFail($id)->delete();

        return $this->index();
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        Faq::create($data + ['sort_order' => (int) Faq::where('category_id', $data['category_id'])->max('sort_order') + 1]);

        return $this->index();
    }

    public function update(Request $request, int $id): JsonResponse
    {
        Faq::findOrFail($id)->update($this->validated($request));

        return $this->index();
    }

    public function destroy(int $id): JsonResponse
    {
        Faq::findOrFail($id)->delete();

        return $this->index();
    }

    /** Drag-and-drop order: {categories: [id…], items: {categoryId: [faqId…]}} (items may move between categories). */
    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate(['categories' => ['array'], 'categories.*' => ['integer'], 'items' => ['array']]);
        DB::transaction(function () use ($data) {
            foreach ($data['categories'] ?? [] as $i => $id) {
                FaqCategory::whereKey($id)->update(['sort_order' => $i + 1]);
            }
            foreach ($data['items'] ?? [] as $catId => $ids) {
                foreach ((array) $ids as $i => $id) {
                    Faq::whereKey($id)->update(['category_id' => (int) $catId, 'sort_order' => $i + 1]);
                }
            }
        });

        return $this->index();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'category_id' => ['required', 'integer', 'exists:faq_categories,id'],
            'question' => ['required', 'string', 'max:255'],
            'answer' => ['required', 'string', 'max:5000'],
            'is_active' => ['boolean'],
        ]);
    }
}
