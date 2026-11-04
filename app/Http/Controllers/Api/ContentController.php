<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PageResource;
use App\Models\FaqCategory;
use App\Models\Page;
use App\Support\Content;
use Illuminate\Http\JsonResponse;

/**
 * @group Content
 *
 * @unauthenticated
 */
class ContentController extends Controller
{
    /**
     * Policy page
     *
     * @urlParam slug string required shipping-policy, returns, privacy-policy, terms or warranty. Example: returns
     */
    public function page(string $slug): PageResource
    {
        return new PageResource(Page::where('slug', $slug)->where('is_active', true)->firstOrFail());
    }

    /** FAQs grouped by category. */
    public function faqs(): JsonResponse
    {
        $cats = FaqCategory::with(['faqs' => fn ($q) => $q->where('is_active', true)])->orderBy('sort_order')->get();

        return response()->json(['data' => $cats->filter(fn ($c) => $c->faqs->isNotEmpty())->values()->map(fn ($c) => [
            'category' => $c->name,
            'items' => $c->faqs->map(fn ($f) => ['id' => $f->id, 'q' => $f->question, 'a' => $f->answer])->values(),
        ])]);
    }

    /** About page: story, stats, values, milestones. */
    public function about(): JsonResponse
    {
        return response()->json(['data' => Content::get('about')]);
    }

    /** Services cards. */
    public function services(): JsonResponse
    {
        return response()->json(['data' => Content::get('services', [])]);
    }
}
