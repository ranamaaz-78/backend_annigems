@extends('emails.layout')
@section('content')
<p>Dear {{ $contact->name }},</p>
<div style="white-space:pre-wrap;">{{ $body }}</div>
<p>With warm regards,<br>{{ $staffName }}<br>AANI GEMAS</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
<p style="font-size:12px;color:#7a6d5c;">Your message ({{ $contact->created_at->toFormattedDateString() }}):<br><span style="white-space:pre-wrap;">{{ $contact->message }}</span></p>
@endsection
