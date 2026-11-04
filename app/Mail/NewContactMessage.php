<?php

namespace App\Mail;

use App\Models\ContactMessage;
use Illuminate\Mail\Mailables\Envelope;

class NewContactMessage extends BrandedMail
{
    protected string $template = 'staff.contact-message';

    public function __construct(public ContactMessage $contact) {}

    protected function subjectLine(): string
    {
        return 'New contact message: '.($this->contact->topic ?: 'General');
    }

    public function envelope(): Envelope
    {
        return parent::envelope()->replyTo($this->contact->email, $this->contact->name);
    }
}
