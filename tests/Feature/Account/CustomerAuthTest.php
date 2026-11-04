<?php

namespace Tests\Feature\Account;

use App\Mail\PasswordChangedMail;
use App\Mail\PasswordResetCodeMail;
use App\Mail\WelcomeMail;
use App\Models\PasswordResetCode;
use App\Models\User;
use App\Services\Auth\GoogleTokenVerifier;
use App\Services\Auth\InvalidGoogleToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CustomerAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedStore();
        Mail::fake();
        config(['services.google.client_ids' => ['web' => 'web-id', 'ios' => 'ios-id', 'android' => 'android-id']]);
    }

    private function user(array $attrs = []): User
    {
        return User::create($attrs + ['first_name' => 'Priya', 'last_name' => 'Mehta', 'email' => 'priya@example.com', 'password' => 'secret123']);
    }

    public function test_register_and_login(): void
    {
        $res = $this->api('POST', 'auth/register', [
            'first_name' => 'Priya', 'last_name' => 'Mehta', 'email' => 'Priya@Example.com',
            'password' => 'secret123', 'password_confirmation' => 'secret123', 'terms' => true,
        ])->assertCreated()->assertJsonPath('data.user.email', 'priya@example.com')->assertJsonPath('data.token_type', 'Bearer');
        Mail::assertQueued(WelcomeMail::class);

        $token = $res->json('data.token');
        $this->api('GET', 'me', [], ['Authorization' => "Bearer {$token}"])->assertOk()->assertJsonPath('data.first_name', 'Priya');

        $this->api('POST', 'auth/register', ['first_name' => 'X', 'last_name' => 'Y', 'email' => 'priya@example.com', 'password' => 'secret123', 'password_confirmation' => 'secret123'])
            ->assertStatus(422)->assertJsonPath('errors.email.0', 'An account with this email already exists. Please sign in.');
        $this->api('POST', 'auth/register', ['first_name' => 'X', 'last_name' => 'Y', 'email' => 'x@example.com', 'password' => 'short', 'password_confirmation' => 'short'])
            ->assertStatus(422)->assertJsonPath('errors.password.0', 'Password must be at least 8 characters.');

        $this->api('POST', 'auth/login', ['email' => 'nobody@example.com', 'password' => 'x'])
            ->assertStatus(422)->assertJsonPath('errors.email.0', 'No account found with this email.');
        $this->api('POST', 'auth/login', ['email' => 'priya@example.com', 'password' => 'wrongpass'])
            ->assertStatus(422)->assertJsonPath('errors.password.0', 'Incorrect password. Please try again.');
        $this->api('POST', 'auth/login', ['email' => 'priya@example.com', 'password' => 'secret123'])->assertOk()->assertJsonStructure(['data' => ['token', 'expires_at']]);

        // Mobile requires device_name.
        $this->api('POST', 'auth/login', ['email' => 'priya@example.com', 'password' => 'secret123'], platform: 'mobile')->assertStatus(422)->assertJsonValidationErrors('device_name');
        $this->api('POST', 'auth/login', ['email' => 'priya@example.com', 'password' => 'secret123', 'device_name' => 'iPhone'], platform: 'mobile')->assertOk();
        $this->assertSame(['web:Web browser', 'web:Web browser', 'mobile:iPhone'], User::where('email', 'priya@example.com')->first()->tokens()->pluck('name')->all());
    }

    public function test_login_google_only_and_disabled_accounts(): void
    {
        $this->user(['email' => 'g@example.com', 'password' => null, 'google_id' => 'g-1']);
        $this->api('POST', 'auth/login', ['email' => 'g@example.com', 'password' => 'whatever1'])
            ->assertStatus(422)->assertJsonPath('errors.email.0', 'This account uses Google. Please continue with Google.');

        $u = $this->user(['is_active' => false]);
        $this->api('POST', 'auth/login', ['email' => 'priya@example.com', 'password' => 'secret123'])
            ->assertStatus(422)->assertJsonPath('errors.email.0', 'This account is disabled. Please contact us.');

        // A token of a deactivated user stops working.
        $u->update(['is_active' => true]);
        $token = $u->createToken('web:x')->plainTextToken;
        $u->update(['is_active' => false]);
        $this->api('GET', 'me', [], ['Authorization' => "Bearer {$token}"])->assertStatus(401);
    }

    private function fakeGoogle(array $claims): void
    {
        $this->app->instance(GoogleTokenVerifier::class, new class($claims) implements GoogleTokenVerifier
        {
            public array $lastAllowed = [];

            public function __construct(private array $claims) {}

            public function verify(string $idToken, array $allowedClientIds): array
            {
                $this->lastAllowed = $allowedClientIds;
                if ($idToken === 'bad' || ! in_array($this->claims['aud'], $allowedClientIds, true)) {
                    throw new InvalidGoogleToken('bad');
                }

                return $this->claims + ['given_name' => 'Gia', 'family_name' => 'Rossi', 'picture' => null, 'email_verified' => true];
            }
        });
    }

    public function test_google_creates_links_and_logs_in(): void
    {
        $this->fakeGoogle(['sub' => 'g-123', 'email' => 'gia@example.com', 'aud' => 'web-id']);

        $this->api('POST', 'auth/google', ['id_token' => 'bad'])->assertStatus(422);
        $this->api('POST', 'auth/google', ['id_token' => 'ok'])->assertCreated()->assertJsonPath('data.user.has_password', false);
        $this->assertSame('g-123', User::where('email', 'gia@example.com')->value('google_id'));
        $this->api('POST', 'auth/google', ['id_token' => 'ok'])->assertOk();
        $this->assertSame(1, User::count() - 1); // + demo customer

        // Same verified email → link google_id to the existing password account.
        $this->user();
        $this->fakeGoogle(['sub' => 'g-999', 'email' => 'priya@example.com', 'aud' => 'web-id']);
        $this->api('POST', 'auth/google', ['id_token' => 'ok'])->assertOk()->assertJsonPath('data.user.google_linked', true)->assertJsonPath('data.user.has_password', true);

        // Mobile accepts the iOS/Android client ids, web does not.
        $this->fakeGoogle(['sub' => 'g-ios', 'email' => 'ios@example.com', 'aud' => 'ios-id']);
        $this->api('POST', 'auth/google', ['id_token' => 'ok'])->assertStatus(422);
        $this->api('POST', 'auth/google', ['id_token' => 'ok', 'device_name' => 'iPhone'], platform: 'mobile')->assertCreated();
    }

    public function test_reset_code_flow_expiry_and_attempt_limit(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        $user = $this->user();
        $t1 = $user->createToken('web:a')->plainTextToken;

        $this->api('POST', 'auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk();
        Mail::assertNothingQueued();

        $this->api('POST', 'auth/forgot-password', ['email' => 'priya@example.com'])->assertOk();
        $code = null;
        Mail::assertQueued(PasswordResetCodeMail::class, function ($m) use (&$code) {
            $code = $m->code;

            return true;
        });
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $wrong = $code === '000000' ? '111111' : '000000';

        $this->api('POST', 'auth/verify-reset-code', ['email' => 'priya@example.com', 'code' => $wrong])->assertStatus(422);
        $this->api('POST', 'auth/verify-reset-code', ['email' => 'priya@example.com', 'code' => $code])->assertOk();
        $this->api('POST', 'auth/reset-password', ['email' => 'priya@example.com', 'code' => $code, 'password' => 'newsecret1', 'password_confirmation' => 'newsecret1'])->assertOk();
        $this->assertTrue(Hash::check('newsecret1', $user->fresh()->password));
        $this->assertSame(0, $user->tokens()->count(), 'all tokens revoked');
        Mail::assertQueued(PasswordChangedMail::class);
        $this->app['auth']->forgetGuards();
        $this->api('GET', 'me', [], ['Authorization' => "Bearer {$t1}"])->assertStatus(401);
        // Used codes cannot be reused.
        $this->api('POST', 'auth/reset-password', ['email' => 'priya@example.com', 'code' => $code, 'password' => 'another12', 'password_confirmation' => 'another12'])->assertStatus(422);

        // Attempt limit: 5 wrong tries lock the code, even the right one fails afterwards.
        $this->api('POST', 'auth/forgot-password', ['email' => 'priya@example.com'])->assertOk();
        $row = PasswordResetCode::whereNull('used_at')->latest('id')->first();
        $row->update(['code_hash' => Hash::make('123456')]);
        foreach (range(1, 5) as $i) {
            $this->api('POST', 'auth/verify-reset-code', ['email' => 'priya@example.com', 'code' => '654321'])->assertStatus(422);
        }
        $this->api('POST', 'auth/verify-reset-code', ['email' => 'priya@example.com', 'code' => '123456'])
            ->assertStatus(422)->assertJsonPath('errors.code.0', 'Too many attempts. Please request a new code.');

        // Expiry.
        $this->api('POST', 'auth/forgot-password', ['email' => 'priya@example.com'])->assertOk();
        $row = PasswordResetCode::whereNull('used_at')->latest('id')->first();
        $row->update(['code_hash' => Hash::make('123456'), 'expires_at' => now()->subMinute()]);
        $this->api('POST', 'auth/verify-reset-code', ['email' => 'priya@example.com', 'code' => '123456'])
            ->assertStatus(422)->assertJsonPath('errors.code.0', 'This code has expired. Please request a new one.');
    }

    public function test_logout_and_logout_all(): void
    {
        $user = $this->user();
        $a = $user->createToken('web:a')->plainTextToken;
        $b = $user->createToken('web:b')->plainTextToken;
        $this->api('POST', 'auth/logout', [], ['Authorization' => "Bearer {$a}"])->assertOk();
        $this->assertSame(1, $user->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->api('POST', 'auth/logout-all', [], ['Authorization' => "Bearer {$b}"])->assertOk();
        $this->assertSame(0, $user->tokens()->count());
    }
}
