@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">B2B order {{ $order->order_number }} to approve</h2>
<p>{{ $order->company_name }} · {{ $order->ship_name }} &lt;{{ $order->email }}&gt; · tier {{ $order->b2b_tier_name ?? '-' }} · {{ $order->currency }} · cash on delivery</p>
@include('emails.partials.order-summary')
@include('emails.partials.button', ['url' => url('/admin/b2b/orders/'.$order->order_number), 'label' => 'Review in admin'])
@endsection
