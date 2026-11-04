<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\NewContactMessage;
use App\Models\ContactMessage;
use App\Models\NewsletterSubscriber;
use App\Services\AdminNotify;
use App\Support\Content;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * @group Forms
 *
 * @unauthenticated
 */
class FormsController extends Controller
{
    /**
     * Contact form
     *
     * @bodyParam name string required Example: Priya Mehta
     * @bodyParam email string required Example: priya@example.com
     * @bodyParam topic string One of the contact topics from bootstrap. Example: Order enquiry
     * @bodyParam message string required Example: Hello, I have a question about my order.
     */
    public function contact(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190'],
            'topic' => ['nullable', 'string', Rule::in(Content::get('contact.topics', []))],
            'message' => ['required', 'string', 'min:5', 'max:5000'],
        ], [
            'name.required' => 'Please tell us your name.',
            'email.required' => 'Please enter your email address.',
            'email.email' => 'Please enter a valid email address.',
            'topic.in' => 'Please choose a topic from the list.',
            'message.required' => 'Please write a message.',
            'message.min' => 'Your message is a little short.',
        ]);

        $msg = ContactMessage::create($data + ['status' => 'new', 'source' => $request->attributes->get('platform', 'web')]);
        if ($to = AdminNotify::address()) {
            Mail::to($to)->queue(new NewContactMessage($msg));
        }

        return response()->json(['message' => 'Thank you! Our team will get back to you within one business day.', 'data' => ['id' => $msg->id]], 201);
    }

    /**
     * Newsletter signup
     *
     * @bodyParam email string required Example: priya@example.com
     */
    public function newsletter(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:190']], [
            'email.required' => 'Please enter your email address.',
            'email.email' => 'Please enter a valid email address.',
        ]);
        $email = Str::lower($data['email']);
        $sub = NewsletterSubscriber::firstOrNew(['email' => $email]);
        $already = $sub->exists && ! $sub->unsubscribed_at;
        if (! $already) {
            $sub->fill([
                'source' => $request->attributes->get('platform', 'web'),
                'subscribed_at' => now(),
                'unsubscribed_at' => null,
            ])->save();
        }

        return response()->json([
            'message' => $already ? 'You are already subscribed. Thank you!' : 'Thank you for subscribing!',
            'data' => ['email' => $email],
        ], $already ? 200 : 201);
    }
}
