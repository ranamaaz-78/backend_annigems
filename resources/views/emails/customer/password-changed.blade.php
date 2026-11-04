@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">Your password was changed</h2>
<p>Hello {{ $user->first_name }}, the password of your AANI GEMAS account was just changed and you have been signed out on all devices.</p>
<p>If this was not you, please reset your password right away and contact us at {{ \App\Models\Setting::get('app.support_email', 'care@aanigems.com') }}.</p>
@include('emails.partials.button', ['url' => $storefrontUrl.'/login', 'label' => 'Sign in'])
@endsection
