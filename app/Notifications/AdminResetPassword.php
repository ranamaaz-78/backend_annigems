<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AdminResetPassword extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url('/admin/reset-password?token='.$this->token.'&email='.urlencode($notifiable->email));

        return (new MailMessage)
            ->subject(config('app.name').' admin: reset your password')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('We received a request to reset your admin panel password.')
            ->action('Reset password', $url)
            ->line('This link expires in 60 minutes. If you did not ask for it, ignore this email.');
    }
}
