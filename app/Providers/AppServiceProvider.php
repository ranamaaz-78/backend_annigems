<?php

namespace App\Providers;

use App\Models\Setting;
use App\Services\Auth\GoogleJwtVerifier;
use App\Services\Auth\GoogleTokenVerifier;
use App\Services\CurrencyService;
use App\Services\GoldRateService;
use App\Services\Rates\ExchangeRateProvider;
use App\Services\Rates\GoldApiProvider;
use App\Services\Rates\GoldRateProvider;
use App\Services\Rates\OpenErApiProvider;
use App\Services\Stripe\StripeClientGateway;
use App\Services\Stripe\StripeGateway;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(CurrencyService::class);
        $this->app->scoped(GoldRateService::class);
        $this->app->bind(ExchangeRateProvider::class, OpenErApiProvider::class);
        $this->app->bind(GoogleTokenVerifier::class, GoogleJwtVerifier::class);
        $this->app->singleton(StripeGateway::class, StripeClientGateway::class);
        $this->app->bind(GoldRateProvider::class, function () {
            $providers = ['goldapi' => GoldApiProvider::class];

            return $this->app->make($providers[Setting::get('gold.api_provider', 'goldapi')] ?? GoldApiProvider::class);
        });
    }

    public function boot(): void
    {
        // Super Admin can do everything.
        Gate::before(fn ($user) => method_exists($user, 'hasRole') && $user->hasRole('Super Admin') ? true : null);

        $key = fn (Request $r) => strtolower((string) $r->input('email')).'|'.$r->ip();
        RateLimiter::for('admin-login', fn (Request $r) => Limit::perMinute(10)->by($key($r)));
        RateLimiter::for('auth', fn (Request $r) => [Limit::perMinute(10)->by($key($r)), Limit::perMinute(30)->by($r->ip())]);
        RateLimiter::for('forms', fn (Request $r) => Limit::perMinute(5)->by($r->ip()));
        RateLimiter::for('checkout', fn (Request $r) => Limit::perMinute(20)->by($r->user()?->id ?: $r->ip()));
        RateLimiter::for('coupon', fn (Request $r) => Limit::perMinute(60)->by($r->ip()));
    }
}
