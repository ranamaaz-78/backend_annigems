<?php

namespace App\Http\Controllers\Admin\Content;

use App\Http\Controllers\Controller;
use App\Mail\ContactReplyMail;
use App\Models\ContactMessage;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** @group Admin: Messages */
class MessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = ContactMessage::query()->with('admin:id,name');
        if ($request->filled('status')) {
            $q->where('status', $request->input('status'));
        }
        if (($t = trim((string) $request->input('q'))) !== '') {
            $q->where(fn ($w) => $w->where('name', 'like', "%{$t}%")->orWhere('email', 'like', "%{$t}%")->orWhere('message', 'like', "%{$t}%"));
        }
        $page = $q->latest('id')->paginate(min(100, $request->integer('per_page', 20) ?: 20));

        return response()->json([
            'data' => $page->items(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
            'counts' => ContactMessage::selectRaw('status, count(*) c')->groupBy('status')->pluck('c', 'status'),
        ]);
    }

    /** Opening a new message marks it read. */
    public function show(int $id): JsonResponse
    {
        $m = ContactMessage::with('admin:id,name')->findOrFail($id);
        if ($m->status === 'new') {
            $m->update(['status' => 'read']);
        }

        return response()->json(['data' => $m]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:new,read,replied']]);
        $m = ContactMessage::findOrFail($id);
        $m->update($data + ($data['status'] === 'replied' ? ['replied_at' => $m->replied_at ?? now(), 'admin_user_id' => $request->user('admin')->id] : []));

        return response()->json(['data' => $m->fresh('admin:id,name')]);
    }

    /** Sends the reply by email (Reply-To: support address) and marks the message replied. */
    public function reply(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'min:2', 'max:10000']]);
        $m = ContactMessage::findOrFail($id);
        Mail::to($m->email, $m->name)->queue(new ContactReplyMail($m, $data['body'], $request->user('admin')->name));
        $m->update(['status' => 'replied', 'replied_at' => now(), 'admin_user_id' => $request->user('admin')->id]);
        activity('messages')->causedBy($request->user('admin'))->performedOn($m)->withProperties(['body' => $data['body']])->log('Replied to contact message');

        return response()->json(['data' => $m->fresh('admin:id,name'), 'message' => 'Reply sent.']);
    }

    public function destroy(int $id): JsonResponse
    {
        ContactMessage::findOrFail($id)->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    // ---- newsletter ----------------------------------------------------------

    public function subscribers(Request $request): JsonResponse
    {
        $q = $this->subscriberQuery($request);
        $page = $q->paginate(min(100, $request->integer('per_page', 20) ?: 20));

        return response()->json([
            'data' => $page->items(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem()],
            'active_total' => NewsletterSubscriber::whereNull('unsubscribed_at')->count(),
        ]);
    }

    public function exportSubscribers(Request $request): StreamedResponse
    {
        $q = $this->subscriberQuery($request);

        return response()->streamDownload(function () use ($q) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['email', 'source', 'subscribed_at', 'unsubscribed_at']);
            $q->chunk(1000, function ($rows) use ($out) {
                foreach ($rows as $s) {
                    fputcsv($out, [$s->email, $s->source, $s->subscribed_at?->toDateTimeString(), $s->unsubscribed_at?->toDateTimeString()]);
                }
            });
            fclose($out);
        }, 'newsletter-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv']);
    }

    public function unsubscribe(int $id): JsonResponse
    {
        NewsletterSubscriber::findOrFail($id)->update(['unsubscribed_at' => now()]);

        return response()->json(['message' => 'Unsubscribed.']);
    }

    public function destroySubscriber(int $id): JsonResponse
    {
        NewsletterSubscriber::findOrFail($id)->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    private function subscriberQuery(Request $request)
    {
        $q = NewsletterSubscriber::query()->latest('id');
        if (($t = trim((string) $request->input('q'))) !== '') {
            $q->where('email', 'like', "%{$t}%");
        }
        if ($request->input('status') === 'active') {
            $q->whereNull('unsubscribed_at');
        } elseif ($request->input('status') === 'unsubscribed') {
            $q->whereNotNull('unsubscribed_at');
        }

        return $q;
    }
}
