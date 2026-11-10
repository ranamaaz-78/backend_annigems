@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">We have received your order</h2>
<p>Hello {{ $order->ship_name }}, thank you for order <strong>{{ $order->order_number }}</strong>{{ $order->company_name ? ' for '.$order->company_name : '' }}. Our team will review it and email you as soon as it is approved.</p>
<p>Payment: <strong>cash on delivery</strong>.</p>
@include('emails.partials.order-summary')
@include('emails.partials.button', ['url' => $storefrontUrl.'/b2b/orders/'.$order->order_number, 'label' => 'View your order'])
@endsection
