<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AddressResource;
use App\Models\Address;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * @group Account
 *
 * @authenticated
 */
class AddressController extends Controller
{
    /** List addresses (default first). */
    public function index(Request $request): AnonymousResourceCollection
    {
        return AddressResource::collection($request->user()->addresses()->with('country')->get());
    }

    /**
     * Add address
     *
     * The first address becomes the default.
     *
     * @bodyParam label string Example: Home
     * @bodyParam name string required Example: Priya Mehta
     * @bodyParam phone string Example: +91 98765 43210
     * @bodyParam line1 string required Example: 21 Linking Road
     * @bodyParam city string required Example: Mumbai
     * @bodyParam state string Example: Maharashtra
     * @bodyParam zip string required Example: 400050
     * @bodyParam country_code string required ISO code of an active shipping country. Example: IN
     * @bodyParam is_default boolean Example: false
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(static::rules(), static::messages());
        $user = $request->user();

        $address = DB::transaction(function () use ($user, $data) {
            $first = ! $user->addresses()->exists();
            $address = $user->addresses()->create(collect($data)->except('is_default')->all() + ['is_default' => false]);
            if ($first || ! empty($data['is_default'])) {
                $this->makeDefault($address);
            }

            return $address;
        });

        return (new AddressResource($address->fresh('country')))->response()->setStatusCode(201);
    }

    /** Update address */
    public function update(Request $request, int $id): AddressResource
    {
        $address = $this->find($request, $id);
        $data = $request->validate(static::rules(), static::messages());
        DB::transaction(function () use ($address, $data) {
            $address->update(collect($data)->except('is_default')->all());
            if (! empty($data['is_default'])) {
                $this->makeDefault($address);
            }
        });

        return new AddressResource($address->fresh('country'));
    }

    /** Delete address (if it was the default, the oldest remaining one becomes default). */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $address = $this->find($request, $id);
        DB::transaction(function () use ($request, $address) {
            $wasDefault = $address->is_default;
            $address->delete();
            if ($wasDefault && ($next = $request->user()->addresses()->oldest('id')->first())) {
                $this->makeDefault($next);
            }
        });

        return response()->json(['message' => 'Address removed.']);
    }

    /** Make default */
    public function setDefault(Request $request, int $id): AddressResource
    {
        $address = $this->find($request, $id);
        DB::transaction(fn () => $this->makeDefault($address));

        return new AddressResource($address->fresh('country'));
    }

    private function find(Request $request, int $id): Address
    {
        return $request->user()->addresses()->whereKey($id)->firstOrFail();
    }

    /** Only one default per user. */
    private function makeDefault(Address $address): void
    {
        Address::where('user_id', $address->user_id)->whereKeyNot($address->id)->update(['is_default' => false]);
        $address->forceFill(['is_default' => true])->save();
    }

    public static function rules(string $prefix = ''): array
    {
        return [
            $prefix.'label' => ['nullable', 'string', 'max:40'],
            $prefix.'name' => ['required', 'string', 'max:120'],
            $prefix.'phone' => ['nullable', 'string', 'max:40'],
            $prefix.'line1' => ['required', 'string', 'max:255'],
            $prefix.'city' => ['required', 'string', 'max:120'],
            $prefix.'state' => ['nullable', 'string', 'max:120'],
            $prefix.'zip' => ['required', 'string', 'max:20'],
            $prefix.'country_code' => ['required', 'string', 'size:2', Rule::exists('countries', 'code')->where('is_active', true)],
            $prefix.'is_default' => ['sometimes', 'boolean'],
        ];
    }

    public static function messages(string $prefix = ''): array
    {
        return [
            $prefix.'name.required' => 'Please enter the recipient name.',
            $prefix.'line1.required' => 'Please enter the street address.',
            $prefix.'city.required' => 'Please enter the city.',
            $prefix.'zip.required' => 'Please enter the postal code.',
            $prefix.'country_code.required' => 'Please choose a country.',
            $prefix.'country_code.exists' => 'We do not ship to this country yet.',
            $prefix.'country_code.size' => 'Please choose a country.',
        ];
    }
}
