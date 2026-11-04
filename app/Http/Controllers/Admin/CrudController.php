<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Small REST base for admin resources: server-side pagination, sorting
 * (`sort=field` / `sort=-field`), search (`q`) and `is_active` filter.
 */
abstract class CrudController extends Controller
{
    /** @var class-string<Model> */
    protected string $model;

    protected array $searchable = [];

    protected array $sortable = ['id'];

    protected string $defaultSort = '-id';

    protected array $with = [];

    abstract protected function rules(Request $request, ?Model $model = null): array;

    protected function messages(): array
    {
        return [];
    }

    protected function filter(Builder $query, Request $request): void {}

    protected function transform(Model $model): array
    {
        return $model->toArray();
    }

    /** Hook to adjust validated data before save. */
    protected function prepare(array $data, Request $request, ?Model $model = null): array
    {
        return $data;
    }

    protected function afterSave(Model $model, array $data, Request $request): void {}

    public function index(Request $request): JsonResponse
    {
        $q = $this->model::query()->with($this->with);

        if (($term = trim((string) $request->input('q'))) !== '' && $this->searchable) {
            $q->where(function ($w) use ($term) {
                foreach ($this->searchable as $col) {
                    $w->orWhere($col, 'like', '%'.$term.'%');
                }
            });
        }
        if ($request->filled('is_active')) {
            $q->where('is_active', $request->boolean('is_active'));
        }
        $this->filter($q, $request);

        $sort = (string) $request->input('sort', $this->defaultSort);
        $col = ltrim($sort, '-');
        if (in_array($col, $this->sortable, true)) {
            $q->orderBy($col, str_starts_with($sort, '-') ? 'desc' : 'asc');
        }
        $q->orderBy($q->getModel()->getQualifiedKeyName());

        if ($request->boolean('all')) {
            return response()->json(['data' => $q->limit(500)->get()->map(fn ($m) => $this->transform($m))]);
        }
        $page = $q->paginate(min(100, max(1, $request->integer('per_page', 20))));

        return response()->json([
            'data' => collect($page->items())->map(fn ($m) => $this->transform($m)),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'from' => $page->firstItem(),
                'to' => $page->lastItem(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['data' => $this->transform($this->find($id))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->prepare($request->validate($this->rules($request), $this->messages()), $request);
        $model = $this->model::create($data);
        $this->afterSave($model, $data, $request);

        return response()->json(['data' => $this->transform($model->fresh($this->with)), 'message' => 'Saved.'], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $model = $this->find($id);
        $data = $this->prepare($request->validate($this->rules($request, $model), $this->messages()), $request, $model);
        $model->update($data);
        $this->afterSave($model, $data, $request);

        return response()->json(['data' => $this->transform($model->fresh($this->with)), 'message' => 'Saved.']);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->find($id)->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    protected function find(int $id): Model
    {
        return $this->model::with($this->with)->findOrFail($id);
    }
}
