@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">Gold-rate API is failing</h2>
<p>The gold-rate provider has failed <strong>{{ $failures }}</strong> consecutive fetches.</p>
<p>Last error: <code>{{ $error }}</code></p>
@if($lastGood)
<p>The store keeps using the last good API rate: <strong>€{{ number_format($lastGood->rate_per_oz / 100, 2) }}/oz</strong> from {{ $lastGood->fetched_at->toDayDateTimeString() }} UTC.</p>
@endif
<p>Check the API key and quota, or switch the source to manual in Admin → Pricing → Gold rate.</p>
@endsection
