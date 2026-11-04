<?php

namespace App\Services\Auth;

use App\Mail\PasswordResetCodeMail;
use App\Models\PasswordResetCode;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** 6-digit email codes, valid 15 minutes, max 5 attempts per code. */
class PasswordResetCodeService
{
    public function send(string $email): void
    {
        $email = Str::lower(trim($email));
        $user = User::where('email', $email)->first();
        if (! $user || ! $user->is_active) {
            return; // generic response either way
        }

        PasswordResetCode::where('email', $email)->whereNull('used_at')->delete();
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        PasswordResetCode::create([
            'email' => $email,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(PasswordResetCode::TTL_MINUTES),
        ]);
        Mail::to($user->email)->queue(new PasswordResetCodeMail($user, $code));
    }

    /** Returns the matching code row or throws a user-friendly validation error. */
    public function check(string $email, string $code): PasswordResetCode
    {
        $row = PasswordResetCode::where('email', Str::lower(trim($email)))->whereNull('used_at')->latest('id')->first();

        if (! $row) {
            $this->fail('This code is not valid. Please request a new one.');
        }
        if ($row->expires_at->isPast()) {
            $this->fail('This code has expired. Please request a new one.');
        }
        if ($row->attempts >= PasswordResetCode::MAX_ATTEMPTS) {
            $this->fail('Too many attempts. Please request a new code.');
        }
        if (! Hash::check(trim($code), $row->code_hash)) {
            $row->increment('attempts');
            $left = PasswordResetCode::MAX_ATTEMPTS - $row->attempts;
            $this->fail($left > 0 ? "The code is incorrect. {$left} attempt".($left === 1 ? '' : 's').' left.' : 'Too many attempts. Please request a new code.');
        }

        return $row;
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['code' => $message]);
    }
}
