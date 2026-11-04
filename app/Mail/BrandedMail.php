<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Base for every email: queued, rendered with the branded Blade layout.
 * Subclasses set $subjectLine, $view and public data properties.
 */
abstract class BrandedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    protected string $template;

    abstract protected function subjectLine(): string;

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine());
    }

    public function content(): Content
    {
        return new Content(view: 'emails.'.$this->template, with: [
            'storefrontUrl' => config('services.storefront.url'),
            'brand' => config('app.name'),
        ]);
    }
}
