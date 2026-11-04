<?php

namespace App\Models;

use App\Notifications\AdminResetPassword;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Permission\Traits\HasRoles;

class AdminUser extends Authenticatable
{
    use HasFactory, HasRoles, LogsActivity, Notifiable;

    protected string $guard_name = 'admin';

    protected $fillable = ['name', 'email', 'password', 'is_active'];

    protected $attributes = ['is_active' => true];

    protected $hidden = ['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'encrypted:array',
            'two_factor_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    public function hasTwoFactorEnabled(): bool
    {
        return $this->two_factor_secret !== null && $this->two_factor_confirmed_at !== null;
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new AdminResetPassword($token));
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logOnly(['name', 'email', 'is_active'])->logOnlyDirty()->useLogName('staff');
    }
}
