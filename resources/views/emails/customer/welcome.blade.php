@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">Welcome, {{ $user->first_name }}</h2>
<p>Thank you for creating your AANI GEMAS account. Every piece we make is handcrafted in 18K gold, and you can now save favourites, design your own ring and follow your orders from your account.</p>
@include('emails.partials.button', ['url' => $storefrontUrl.'/shop', 'label' => 'Explore the collection'])
<p>With warm regards,<br>The AANI GEMAS atelier</p>
@endsection
