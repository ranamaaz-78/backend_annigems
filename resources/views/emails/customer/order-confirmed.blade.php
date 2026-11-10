@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">Thank you for your order</h2>
@if($order->isBusiness())
<p>Hello {{ $order->ship_name }}, your order <strong>{{ $order->order_number }}</strong> has been approved. Payment is cash on delivery. Our artisans will begin shortly and we will email you at every stage.</p>
@else
<p>Hello {{ $order->ship_name }}, we have received your payment for order <strong>{{ $order->order_number }}</strong>. Our artisans will begin shortly and we will email you at every stage.</p>
@endif
@include('emails.partials.order-summary')
@include('emails.partials.button', ['url' => $storefrontUrl.($order->isBusiness() ? '/b2b/orders/' : '/account/orders/').$order->order_number, 'label' => 'View your order'])
@endsection
