<?php

namespace Tests\Feature\Account;

use App\Models\Address;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedStore();
        Mail::fake();
        $this->user = User::create(['first_name' => 'Priya', 'last_name' => 'Mehta', 'email' => 'priya@example.com', 'password' => 'secret123']);
        Sanctum::actingAs($this->user);
    }

    private function address(array $over = []): array
    {
        return $over + ['label' => 'Home', 'name' => 'Priya Mehta', 'line1' => '21 Linking Road', 'city' => 'Mumbai', 'zip' => '400050', 'country_code' => 'IN'];
    }

    public function test_profile_and_password(): void
    {
        $this->api('PUT', 'me', ['first_name' => 'P', 'last_name' => 'M', 'phone' => '123', 'preferred_currency' => 'INR'])
            ->assertOk()->assertJsonPath('data.preferred_currency', 'INR');
        $this->api('PUT', 'me', ['first_name' => 'P', 'last_name' => 'M', 'preferred_currency' => 'JPY'])->assertStatus(422);

        $this->api('PUT', 'me/password', ['current_password' => 'nope', 'password' => 'newsecret1', 'password_confirmation' => 'newsecret1'])
            ->assertStatus(422)->assertJsonPath('errors.current_password.0', 'Your current password is incorrect.');
    }

    public function test_google_only_user_sets_first_password_without_current(): void
    {
        $g = User::create(['first_name' => 'G', 'last_name' => 'U', 'email' => 'g@example.com', 'password' => null, 'google_id' => 'x']);
        $token = $g->createToken('web:t');
        Sanctum::actingAs($g->withAccessToken($token->accessToken));
        $this->api('PUT', 'me/password', ['password' => 'firstpass1', 'password_confirmation' => 'firstpass1'])->assertOk();
        $this->assertTrue($g->fresh()->hasPassword());
    }

    public function test_addresses_single_default(): void
    {
        $a = $this->api('POST', 'me/addresses', $this->address())->assertCreated()->assertJsonPath('data.is_default', true)->json('data.id');
        $b = $this->api('POST', 'me/addresses', $this->address(['label' => 'Office']))->assertCreated()->assertJsonPath('data.is_default', false)->json('data.id');
        $this->api('POST', "me/addresses/{$b}/default")->assertOk()->assertJsonPath('data.is_default', true);
        $this->assertSame([$b], Address::where('user_id', $this->user->id)->where('is_default', true)->pluck('id')->all());
        $this->api('DELETE', "me/addresses/{$b}")->assertOk();
        $this->assertTrue(Address::find($a)->is_default);
        $this->api('POST', 'me/addresses', $this->address(['country_code' => 'ZZ']))->assertStatus(422)->assertJsonValidationErrors('country_code');
        $this->api('GET', 'me/addresses')->assertOk()->assertJsonCount(1, 'data');

        $other = User::create(['first_name' => 'O', 'last_name' => 'U', 'email' => 'o@example.com', 'password' => 'secret123']);
        $foreign = $other->addresses()->create($this->address());
        $this->api('PUT', "me/addresses/{$foreign->id}", $this->address())->assertNotFound();
    }

    public function test_wishlist(): void
    {
        $r1 = Product::findBySlugOrLegacy('r1');
        $this->api('POST', "wishlist/{$r1->id}")->assertOk()->assertJsonCount(1, 'data');
        $this->api('POST', 'wishlist/sync', ['product_ids' => ['r1', 'n1', 'nope', Product::findBySlugOrLegacy('e1')->id]])
            ->assertOk()->assertJsonCount(3, 'data');
        $this->api('DELETE', 'wishlist/n1')->assertOk()->assertJsonCount(2, 'data');
        $this->api('POST', 'wishlist/999999')->assertNotFound();
    }

    public function test_delete_account_anonymises_and_revokes(): void
    {
        $this->api('POST', 'me/addresses', $this->address())->assertCreated();
        $this->api('DELETE', 'me', ['password' => 'wrong'])->assertStatus(422);
        $this->api('DELETE', 'me', ['password' => 'secret123'])->assertOk();

        $u = User::withTrashed()->find($this->user->id);
        $this->assertTrue($u->trashed());
        $this->assertSame("deleted+{$u->id}@deleted.invalid", $u->email);
        $this->assertNull($u->phone);
        $this->assertSame(0, Address::withTrashed()->where('user_id', $u->id)->count());
        $this->assertSame(0, $u->tokens()->count());
        // The email can be used again.
        $this->api('POST', 'auth/register', ['first_name' => 'P', 'last_name' => 'M', 'email' => 'priya@example.com', 'password' => 'secret123', 'password_confirmation' => 'secret123'])->assertCreated();
    }

    public function test_mobile_devices(): void
    {
        $this->api('POST', 'devices', ['token' => 'abc', 'platform' => 'ios'], platform: 'mobile')->assertCreated();
        $this->assertSame(1, $this->user->devices()->count());
        $this->api('DELETE', 'devices/abc', platform: 'mobile')->assertOk();
        $this->assertSame(0, $this->user->devices()->count());
        $this->api('POST', 'devices', ['token' => 'abc', 'platform' => 'ios'])->assertNotFound(); // mobile only
    }

    public function test_guest_is_rejected(): void
    {
        $this->app['auth']->forgetGuards();
        $this->refreshApplication();
        $this->api('GET', 'me')->assertStatus(401)->assertJsonPath('message', 'Please sign in to continue.');
    }
}
