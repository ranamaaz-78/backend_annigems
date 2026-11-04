@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">Order {{ $order->order_number }} cancelled</h2>
<p>Your order has been cancelled{{ $order->cancel_reason ? ' ('.$order->cancel_reason.')' : '' }}. No payment was taken.</p>
<p>If you still would like these pieces, you can add them to your bag again from your account.</p>
@include('emails.partials.button', ['url' => $storefrontUrl.'/account/orders/'.$order->order_number, 'label' => 'View order'])
@endsection
