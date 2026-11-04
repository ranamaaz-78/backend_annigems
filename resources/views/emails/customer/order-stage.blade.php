@extends('emails.layout')
@section('content')
@php($label = \App\Models\OrderStage::where('code', $stage)->first())
<h2 style="margin-top:0;">{{ $label->label ?? ucfirst(str_replace('_', ' ', $stage)) }}</h2>
<p>Order <strong>{{ $order->order_number }}</strong>: {{ $label->description ?? 'Your order has moved to the next stage.' }}</p>
@if($stage === 'shipped')
<p>Carrier: <strong>{{ $order->carrier }}</strong><br>Tracking number: <strong>{{ $order->tracking_number }}</strong></p>
@if($order->tracking_url)
@include('emails.partials.button', ['url' => $order->tracking_url, 'label' => 'Track your parcel'])
@endif
@endif
@if($stage === 'delivered')
<p>We hope you love it. Care tips: store your piece in its pouch, avoid harsh chemicals and clean gently with a soft cloth.</p>
@endif
@include('emails.partials.button', ['url' => $storefrontUrl.'/account/orders/'.$order->order_number, 'label' => 'View your order'])
@endsection
