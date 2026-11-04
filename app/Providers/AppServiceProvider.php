<?php

namespace App\Providers;

use App\Services\CurrencyService;
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
    }

    public function boot(): void
    {
        // Super Admin can do everything.
        Gate::before(fn ($user) => method_exists($user, 'hasRole') && $user->hasRole('Super Admin') ? true : null);

        $key = fn (Request $r) => strtolower((string) $r->input('email')).'|'.$r->ip();
        RateLimiter::for('admin-login', fn (Request $r) => Limit::perMinute(10)->by($key($r)));
        RateLimiter::for('auth', fn (Request $r) => [Limit::perMinute(10)->by($key($r)), Limit::perMinute(30)->by($r->ip())]);
        RateLimiter::for('forms', fn (Request $r) => Limit::perMinute(5)->by($r->ip()));
        RateLimiter::for('coupon', fn (Request $r) => Limit::perMinute(20)->by($r->ip()));
    }
}
