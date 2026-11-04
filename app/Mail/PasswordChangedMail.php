<?php

namespace App\Mail;

use App\Models\User;

class PasswordChangedMail extends BrandedMail
{
    protected string $template = 'customer.password-changed';

    public function __construct(public User $user) {}

    protected function subjectLine(): string
    {
        return 'Your AANI GEMAS password was changed';
    }
}
