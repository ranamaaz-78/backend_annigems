<?php

namespace App\Http\Controllers\Admin\System;

use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;

/** @group Admin: Activity log */
class ActivityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Activity::query()->with('causer')->latest('id');
        if ($request->filled('log_name')) {
            $q->where('log_name', $request->input('log_name'));
        }
        if ($request->filled('causer_id')) {
            $q->where('causer_type', (new AdminUser)->getMorphClass())->where('causer_id', $request->integer('causer_id'));
        }
        if (($t = trim((string) $request->input('q'))) !== '') {
            $q->where(fn ($w) => $w->where('description', 'like', "%{$t}%")->orWhere('properties', 'like', "%{$t}%"));
        }
        if ($request->filled('from')) {
            $q->where('created_at', '>=', $request->date('from')->startOfDay());
        }
        if ($request->filled('to')) {
            $q->where('created_at', '<=', $request->date('to')->endOfDay());
        }
        $page = $q->paginate(min(100, $request->integer('per_page', 30) ?: 30));

        return response()->json([
            'data' => collect($page->items())->map(fn (Activity $a) => [
                'id' => $a->id,
                'log_name' => $a->log_name,
                'description' => $a->description,
                'event' => $a->event,
                'subject' => $a->subject_type ? class_basename($a->subject_type).' #'.$a->subject_id : null,
                'causer' => $a->causer?->name ?? ($a->causer_type ? class_basename($a->causer_type).' #'.$a->causer_id : 'System'),
                'properties' => $a->properties,
                'created_at' => $a->created_at->toIso8601String(),
            ]),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
            'log_names' => Activity::query()->distinct()->orderBy('log_name')->pluck('log_name'),
        ]);
    }
}
