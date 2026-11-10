<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\PasswordResetCodeService;
use App\Services\CurrencyService;
use App\Support\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** @group Admin: Customers */
class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // Retail customers only; business accounts are managed in the B2B section.
        $q = User::query()->where('account_type', 'customer')->withCount('orders')
            ->withSum(['orders as lifetime_value_eur' => fn ($o) => $o->whereIn('status', ['paid', 'partially_refunded'])], 'total_eur');
        if (($term = trim((string) $request->input('q'))) !== '') {
            $q->where(fn ($w) => $w->where('email', 'like', "%{$term}%")->orWhere('first_name', 'like', "%{$term}%")
                ->orWhere('last_name', 'like', "%{$term}%")->orWhere('phone', 'like', "%{$term}%"));
        }
        if ($request->filled('is_active')) {
            $q->where('is_active', $request->boolean('is_active'));
        }
        if ($request->boolean('with_deleted')) {
            $q->withTrashed();
        }
        $sort = (string) $request->input('sort', '-id');
        $col = ltrim($sort, '-');
        if (in_array($col, ['id', 'email', 'first_name', 'created_at', 'last_login_at', 'orders_count', 'lifetime_value_eur'], true)) {
            $q->orderBy($col, str_starts_with($sort, '-') ? 'desc' : 'asc');
        }
        $page = $q->orderByDesc('id')->paginate(min(100, max(1, $request->integer('per_page', 20))));

        return response()->json([
            'data' => collect($page->items())->map(fn (User $u) => $this->row($u)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
        ]);
    }

    private function row(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'first_name' => $u->first_name,
            'last_name' => $u->last_name,
            'email' => $u->email,
            'phone' => $u->phone,
            'is_active' => $u->is_active,
            'deleted' => $u->trashed(),
            'has_password' => $u->hasPassword(),
            'google_linked' => $u->google_id !== null,
            'preferred_currency' => $u->preferred_currency,
            'orders_count' => (int) ($u->orders_count ?? 0),
            'lifetime_value_eur' => (int) ($u->lifetime_value_eur ?? 0),
            'last_login_at' => $u->last_login_at?->toIso8601String(),
            'created_at' => $u->created_at->toIso8601String(),
        ];
    }

    public function show(int $id, CurrencyService $fx): JsonResponse
    {
        $u = User::withTrashed()->withCount('orders')
            ->withSum(['orders as lifetime_value_eur' => fn ($o) => $o->whereIn('status', ['paid', 'partially_refunded'])], 'total_eur')
            ->findOrFail($id);

        return response()->json(['data' => $this->row($u) + [
            'addresses' => $u->addresses()->with('country')->get()->map(fn ($a) => $a->only(['id', 'label', 'name', 'phone', 'line1', 'city', 'state', 'zip', 'country_code', 'is_default']) + ['country' => $a->country?->name]),
            'orders' => $u->orders()->latest('id')->limit(50)->get()->map(fn ($o) => [
                'order_number' => $o->order_number, 'status' => $o->status, 'stage' => $o->stage,
                'total' => $fx->money($o->total, $o->currency), 'total_eur' => $o->total_eur, 'created_at' => $o->created_at->toIso8601String(),
            ]),
            'wishlist' => $u->wishlistProducts()->with('images')->get()->map(fn ($p) => ['id' => $p->id, 'name' => $p->name, 'price' => $p->price, 'image_url' => Media::url($p->images->first()?->path)]),
            'tokens' => $u->tokens()->latest('id')->limit(20)->get(['id', 'name', 'last_used_at', 'created_at', 'expires_at']),
        ]]);
    }

    public function setActive(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $u = User::findOrFail($id);
        $u->forceFill(['is_active' => $data['is_active']])->save();
        if (! $data['is_active']) {
            $u->tokens()->delete();
        }

        return response()->json(['data' => $this->row($u->loadCount('orders')), 'message' => $data['is_active'] ? 'Customer activated.' : 'Customer deactivated and signed out.']);
    }

    public function sendResetCode(int $id, PasswordResetCodeService $codes): JsonResponse
    {
        $u = User::findOrFail($id);
        if (! $u->is_active) {
            throw ValidationException::withMessages(['customer' => 'Activate the customer first.']);
        }
        $codes->send($u->email);
        activity('customers')->causedBy(auth('admin')->user())->performedOn($u)->log('Password reset code sent');

        return response()->json(['message' => 'A 6-digit reset code was emailed to '.$u->email.'.']);
    }
}
