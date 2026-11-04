<?php

namespace App\Mail;

use App\Models\User;

class WelcomeMail extends BrandedMail
{
    protected string $template = 'customer.welcome';

    public function __construct(public User $user) {}

    protected function subjectLine(): string
    {
        return 'Welcome to AANI GEMAS';
    }
}
