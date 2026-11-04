@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">Reset your password</h2>
<p>Hello {{ $user->first_name }}, use this code to reset your password:</p>
<p style="text-align:center;font-size:32px;letter-spacing:10px;font-weight:bold;margin:24px 0;color:#1c1a17;">{{ $code }}</p>
<p>The code is valid for 15 minutes. If you did not ask for it, you can ignore this email; your password stays the same.</p>
@endsection
