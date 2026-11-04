<?php

namespace App\Mail;

use App\Models\User;

class PasswordResetCodeMail extends BrandedMail
{
    protected string $template = 'customer.reset-code';

    public function __construct(public User $user, public string $code) {}

    protected function subjectLine(): string
    {
        return 'Your AANI GEMAS password reset code: '.$this->code;
    }
}
