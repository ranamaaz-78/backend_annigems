<?php

namespace App\Mail;

use App\Models\ContactMessage;

class ContactReplyMail extends BrandedMail
{
    protected string $template = 'customer.contact-reply';

    public function __construct(public ContactMessage $contact, public string $body, public string $staffName) {}

    protected function subjectLine(): string
    {
        return 'Re: '.($this->contact->topic ?: 'Your message to AANI GEMAS');
    }
}
