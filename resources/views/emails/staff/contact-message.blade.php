@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">New contact message</h2>
<p><strong>From:</strong> {{ $contact->name }} &lt;{{ $contact->email }}&gt;<br>
<strong>Topic:</strong> {{ $contact->topic ?: '—' }}</p>
<div style="background:#faf6ee;padding:14px;border-radius:4px;white-space:pre-wrap;">{{ $contact->message }}</div>
<p style="font-size:13px;color:#7a6d5c;">Reply directly to this email, or open Admin → Messages.</p>
@endsection
