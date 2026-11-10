<?php

namespace App\Http\Controllers\Admin\B2b;

use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use App\Models\BusinessProfile;
use App\Models\Country;
use App\Models\Order;
use App\Models\User;
use App\Services\B2bReportService;
use App\Services\CurrencyService;
use App\Support\B2bScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

/**
 * Business (B2B) accounts. A sales person onboards a business (it is assigned to them and active
 * right away) and only sees their own; staff with b2b.manage see all and can reassign the sales person.
 * The id is the storefront user id.
 *
 * @group Admin: B2B
 */
class BusinessController extends Controller
{
    public function __construct(private CurrencyService $fx, private B2bReportService $reports) {}

    public function index(Request $request): JsonResponse
    {
        $q = BusinessProfile::query()->with(['user' => fn ($u) => $u->withTrashed(), 'tier:id,name', 'salesRep:id,name']);
        B2bScope::apply($q, $request);
        if ($request->filled('tier_id')) {
            $q->where('tier_id', $request->integer('tier_id'));
        }
        if ($request->filled('sales_rep_id') && B2bScope::repId($request) === null) {
            $request->input('sales_rep_id') === 'none' ? $q->whereNull('sales_rep_id') : $q->where('sales_rep_id', $request->integer('sales_rep_id'));
        }
        if ($request->filled('is_active')) {
            $q->whereHas('user', fn ($u) => $u->where('is_active', $request->boolean('is_active')));
        }
        if (($t = trim((string) $request->input('q'))) !== '') {
            $q->where(fn ($w) => $w->where('company_name', 'like', "%{$t}%")->orWhere('tax_id', 'like', "%{$t}%")
                ->orWhereHas('user', fn ($u) => $u->where('email', 'like', "%{$t}%")->orWhere('first_name', 'like', "%{$t}%")
                    ->orWhere('last_name', 'like', "%{$t}%")->orWhere('phone', 'like', "%{$t}%")));
        }
        $page = $q->orderBy('company_name')->paginate(min(100, max(1, $request->integer('per_page', 20))));
        $stats = $this->stats(collect($page->items())->pluck('user_id')->all());

        return response()->json([
            'data' => collect($page->items())->map(fn (BusinessProfile $p) => $this->row($p, $stats[$p->user_id] ?? null)),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
        ]);
    }

    /** Orders, sales and commission (EUR, cancelled orders excluded) per business user id. */
    private function stats(array $userIds): array
    {
        if (! $userIds) {
            return [];
        }

        return Order::where('account_type', 'business')->whereIn('user_id', $userIds)->where('status', '!=', 'cancelled')
            ->selectRaw('user_id, count(*) as orders, sum(total_eur) as sales, sum(coalesce(commission_amount_eur, 0)) as commission, max(created_at) as last_order_at')
            ->groupBy('user_id')->get()->keyBy('user_id')->all();
    }

    private function row(BusinessProfile $p, $stat): array
    {
        $u = $p->user;

        return [
            'id' => $p->user_id,
            'company_name' => $p->company_name,
            'business_type' => $p->business_type,
            'tax_id' => $p->tax_id,
            'contact_name' => $u?->name,
            'first_name' => $u?->first_name,
            'last_name' => $u?->last_name,
            'email' => $u?->email,
            'phone' => $u?->phone,
            'is_active' => (bool) $u?->is_active && ! $u?->trashed(),
            'tier_id' => $p->tier_id,
            'sales_rep_id' => $p->sales_rep_id,
            'tier' => $p->tier ? ['id' => $p->tier->id, 'name' => $p->tier->name] : null,
            'sales_rep' => $p->salesRep ? ['id' => $p->salesRep->id, 'name' => $p->salesRep->name] : null,
            'orders_count' => (int) ($stat->orders ?? 0),
            'sales' => $this->fx->money((int) ($stat->sales ?? 0), 'EUR'),
            'commission' => $this->fx->money((int) ($stat->commission ?? 0), 'EUR'),
            'last_order_at' => isset($stat->last_order_at) ? Carbon::parse($stat->last_order_at)->toIso8601String() : null,
            'created_at' => $p->created_at?->toIso8601String(),
        ];
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $p = $this->find($request, $id);
        [$from, $to, $group] = $this->reports->window($request->input('from'), $request->input('to'), $request->input('group', 'month'));

        return response()->json(['data' => $this->row($p, $this->stats([$p->user_id])[$p->user_id] ?? null) + [
            'notes' => $p->notes,
            'addresses' => $p->user->addresses->map(fn ($a) => $a->only(['id', 'label', 'name', 'phone', 'line1', 'city', 'state', 'zip', 'country_code', 'is_default'])),
            'period' => $this->reports->period($from, $to, $group, B2bScope::repId($request), $p->user_id),
        ]]);
    }

    private function rules(Request $request, ?BusinessProfile $p = null): array
    {
        return [
            'company_name' => ['required', 'string', 'max:190'],
            'business_type' => ['nullable', 'string', 'max:80'],
            'tax_id' => ['nullable', 'string', 'max:60'],
            'first_name' => ['required', 'string', 'max:80'],
            'last_name' => ['nullable', 'string', 'max:80'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($p?->user_id)],
            'phone' => ['nullable', 'string', 'max:40'],
            'password' => [$p ? 'nullable' : 'required', 'string', PasswordRule::min(8)],
            'tier_id' => ['required', 'integer', Rule::exists('b2b_tiers', 'id')],
            'sales_rep_id' => ['nullable', 'integer'], // checked in salesRepFor()
            'is_active' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'address' => ['nullable', 'array'],
            'address.line1' => ['required_with:address', 'nullable', 'string', 'max:190'],
            'address.city' => ['required_with:address', 'nullable', 'string', 'max:120'],
            'address.state' => ['nullable', 'string', 'max:120'],
            'address.zip' => ['required_with:address', 'nullable', 'string', 'max:20'],
            'address.country_code' => ['required_with:address', 'nullable', 'string', 'size:2'],
        ];
    }

    private function messages(): array
    {
        return [
            'email.unique' => 'An account with this email already exists.',
            'tier_id.required' => 'Please choose a membership tier.',
            'sales_rep_id.exists' => 'Please choose a valid sales person.',
        ];
    }

    /** Onboard a business: storefront login (account_type business) + company profile (+ default address). */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules($request), $this->messages());
        $repId = $this->salesRepFor($request, $data, null);

        $profile = DB::transaction(function () use ($data, $repId) {
            $user = User::create([
                'first_name' => $data['first_name'], 'last_name' => $data['last_name'] ?? '', 'email' => $data['email'],
                'phone' => $data['phone'] ?? null, 'password' => $data['password'], 'account_type' => 'business',
                'is_active' => $data['is_active'] ?? true,
            ]);
            $profile = $user->businessProfile()->create([
                'company_name' => $data['company_name'], 'business_type' => $data['business_type'] ?? null, 'tax_id' => $data['tax_id'] ?? null,
                'tier_id' => $data['tier_id'], 'sales_rep_id' => $repId, 'notes' => $data['notes'] ?? null,
            ]);
            if (! empty($data['address']['line1'])) {
                $this->saveAddress($user, $data);
            }

            return $profile;
        });
        activity('b2b')->causedBy($request->user('admin'))->performedOn($profile)->log('Business onboarded');

        return response()->json(['data' => $this->row($profile->fresh(['user', 'tier', 'salesRep']), null), 'message' => 'Business account created. They can sign in on the website now.'], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $p = $this->find($request, $id);
        $data = $request->validate($this->rules($request, $p), $this->messages());
        $repId = $this->salesRepFor($request, $data, $p);

        DB::transaction(function () use ($p, $data, $repId) {
            $user = $p->user;
            $user->fill([
                'first_name' => $data['first_name'], 'last_name' => $data['last_name'] ?? '', 'email' => $data['email'],
                'phone' => $data['phone'] ?? null, 'is_active' => $data['is_active'] ?? $user->is_active,
            ]);
            if (! empty($data['password'])) {
                $user->password = $data['password'];
                $user->tokens()->delete();
            }
            $user->save();
            if (! $user->is_active) {
                $user->tokens()->delete();
            }
            $p->update([
                'company_name' => $data['company_name'], 'business_type' => $data['business_type'] ?? null, 'tax_id' => $data['tax_id'] ?? null,
                'tier_id' => $data['tier_id'], 'sales_rep_id' => $repId, 'notes' => $data['notes'] ?? null,
            ]);
            if (! empty($data['address']['line1'])) {
                $this->saveAddress($user, $data);
            }
        });

        return response()->json(['data' => $this->row($p->fresh(['user', 'tier', 'salesRep']), $this->stats([$p->user_id])[$p->user_id] ?? null), 'message' => 'Saved.']);
    }

    /**
     * Sales persons always onboard for themselves and cannot move a business to someone else.
     * Staff with b2b.manage choose the sales person (or none).
     */
    private function salesRepFor(Request $request, array $data, ?BusinessProfile $p): ?int
    {
        $admin = $request->user('admin');
        if (! $admin->can('b2b.manage')) {
            if (! $admin->can('b2b.sales')) {
                abort(403);
            }

            return $p ? $p->sales_rep_id : $admin->id;
        }
        $repId = $data['sales_rep_id'] ?? null;
        if ($repId !== null && ! AdminUser::whereKey($repId)->whereHas('roles', fn ($r) => $r->where('name', SalesRepController::ROLE))->exists()) {
            throw ValidationException::withMessages(['sales_rep_id' => 'Please choose a valid sales person.']);
        }

        return $repId;
    }

    private function saveAddress(User $user, array $data): void
    {
        $a = $data['address'];
        $code = strtoupper($a['country_code']);
        if (! Country::where('code', $code)->exists()) {
            throw ValidationException::withMessages(['address.country_code' => 'Please choose a valid country.']);
        }
        $fields = [
            'label' => 'Business', 'name' => $data['company_name'], 'phone' => $data['phone'] ?? null,
            'line1' => $a['line1'], 'city' => $a['city'], 'state' => $a['state'] ?? null, 'zip' => $a['zip'], 'country_code' => $code,
        ];
        $default = $user->addresses()->where('is_default', true)->first();
        $default ? $default->update($fields) : $user->addresses()->create($fields + ['is_default' => true]);
    }

    private function find(Request $request, int $userId): BusinessProfile
    {
        $p = BusinessProfile::with(['user' => fn ($u) => $u->withTrashed()->with('addresses'), 'tier:id,name', 'salesRep:id,name'])
            ->where('user_id', $userId)->firstOrFail();
        B2bScope::authorize($p->sales_rep_id, $request);

        return $p;
    }
}
