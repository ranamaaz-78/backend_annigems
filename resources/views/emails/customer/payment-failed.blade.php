@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">Your payment did not go through</h2>
<p>The payment for order <strong>{{ $order->order_number }}</strong> failed{{ $reason ? ': '.$reason : '' }}. No money was taken. Your order is saved, so you can try again with the same or another card.</p>
@include('emails.partials.button', ['url' => $storefrontUrl.'/account/orders/'.$order->order_number, 'label' => 'Retry payment'])
@include('emails.partials.order-summary')
@endsection
