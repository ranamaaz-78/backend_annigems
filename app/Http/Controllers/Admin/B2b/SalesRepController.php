<?php

namespace App\Http\Controllers\Admin\B2b;

use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use App\Models\BusinessProfile;
use App\Models\CommissionPayout;
use App\Services\B2bReportService;
use App\Services\CurrencyService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;

/**
 * Sales persons = admin users with the "Sales Person" role and a sales_reps profile (phone, commission %).
 * Their id everywhere in the B2B API is the admin user id. They are deactivated, never deleted,
 * so their orders and commission history stay intact.
 *
 * @group Admin: B2B
 */
class SalesRepController extends Controller
{
    public const ROLE = 'Sales Person';

    public function __construct(private B2bReportService $reports, private CurrencyService $fx) {}

    private function query(): Builder
    {
        return AdminUser::query()->whereHas('roles', fn ($r) => $r->where('name', self::ROLE)->where('guard_name', 'admin'))
            ->with('salesRep');
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->query()->orderBy('name');
        if (($t = trim((string) $request->input('q'))) !== '') {
            $q->where(fn ($w) => $w->where('name', 'like', "%{$t}%")->orWhere('email', 'like', "%{$t}%"));
        }
        if ($request->filled('is_active')) {
            $q->where('is_active', $request->boolean('is_active'));
        }
        $reps = $q->get();
        $counts = BusinessProfile::selectRaw('sales_rep_id, count(*) as c')->groupBy('sales_rep_id')->pluck('c', 'sales_rep_id');
        $totals = $this->reports->commissionTotals();

        return response()->json(['data' => $reps->map(fn (AdminUser $u) => $this->row($u, (int) ($counts[$u->id] ?? 0), $totals->get($u->id)))]);
    }

    /** Active sales persons for dropdowns (id + name). */
    public function options(): JsonResponse
    {
        return response()->json(['data' => $this->query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'email'])
            ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email])]);
    }

    public function show(int $id): JsonResponse
    {
        $u = $this->find($id);
        $businesses = BusinessProfile::with(['user', 'tier:id,name'])->where('sales_rep_id', $u->id)->orderBy('company_name')->get();

        return response()->json(['data' => $this->row($u, $businesses->count(), $this->reports->commissionTotals($u->id)->get($u->id)) + [
            'notes' => $u->salesRep?->notes,
            'businesses' => $businesses->map(fn (BusinessProfile $p) => [
                'id' => $p->user_id, 'company_name' => $p->company_name, 'contact_name' => $p->user?->name,
                'email' => $p->user?->email, 'tier' => $p->tier?->name, 'is_active' => (bool) $p->user?->is_active,
            ]),
            'payouts' => CommissionPayout::where('sales_rep_id', $u->id)->latest('paid_at')->latest('id')->limit(50)->get()
                ->map(fn ($p) => ['id' => $p->id, 'amount' => $this->fx->money($p->amount_eur, 'EUR'), 'paid_at' => $p->paid_at->toDateString(), 'method' => $p->method, 'reference' => $p->reference, 'note' => $p->note]),
        ]]);
    }

    private function row(AdminUser $u, int $businesses, ?array $totals): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'phone' => $u->salesRep?->phone,
            'commission_rate' => (float) ($u->salesRep?->commission_rate ?? 0),
            'is_active' => $u->is_active,
            'two_factor_enabled' => $u->hasTwoFactorEnabled(),
            'businesses_count' => $businesses,
            'commission' => $this->reports->presentTotals($totals ?? ['pending' => 0, 'earned' => 0, 'void' => 0, 'paid' => 0, 'balance' => 0]),
            'last_login_at' => $u->last_login_at?->toIso8601String(),
            'created_at' => $u->created_at->toIso8601String(),
        ];
    }

    private function rules(?AdminUser $u = null): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', Rule::unique('admin_users', 'email')->ignore($u?->id)],
            'phone' => ['nullable', 'string', 'max:40'],
            'commission_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /** Creates the admin login (role Sales Person) and the profile. Without a password, an invitation link is emailed. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules() + ['password' => ['nullable', PasswordRule::min(10)]]);
        $user = DB::transaction(function () use ($data) {
            $user = AdminUser::create([
                'name' => $data['name'], 'email' => Str::lower($data['email']),
                'password' => $data['password'] ?? Str::random(40), 'is_active' => $data['is_active'] ?? true,
            ]);
            $user->assignRole(self::ROLE);
            $user->salesRep()->create(['phone' => $data['phone'] ?? null, 'commission_rate' => $data['commission_rate'], 'notes' => $data['notes'] ?? null]);

            return $user;
        });
        if (empty($data['password'])) {
            Password::broker('admin_users')->sendResetLink(['email' => $user->email]);
        }
        activity('b2b')->causedBy($request->user('admin'))->performedOn($user)->withProperties(['commission_rate' => $data['commission_rate']])->log('Sales person created');

        return response()->json([
            'data' => $this->row($user->load('salesRep'), 0, null),
            'message' => empty($data['password']) ? 'Sales person created; an invitation email with a password link was sent.' : 'Sales person created.',
        ], 201);
    }

    /** Commission % changes apply to new orders only (orders keep the rate they were placed with). */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $this->find($id);
        $data = $request->validate($this->rules($user));
        DB::transaction(function () use ($user, $data) {
            $user->update(['name' => $data['name'], 'email' => Str::lower($data['email']), 'is_active' => $data['is_active'] ?? $user->is_active]);
            $user->salesRep()->updateOrCreate([], ['phone' => $data['phone'] ?? null, 'commission_rate' => $data['commission_rate'], 'notes' => $data['notes'] ?? null]);
        });
        $count = BusinessProfile::where('sales_rep_id', $user->id)->count();

        return response()->json(['data' => $this->row($user->fresh('salesRep'), $count, $this->reports->commissionTotals($user->id)->get($user->id)), 'message' => 'Saved.']);
    }

    private function find(int $id): AdminUser
    {
        return $this->query()->findOrFail($id);
    }
}
