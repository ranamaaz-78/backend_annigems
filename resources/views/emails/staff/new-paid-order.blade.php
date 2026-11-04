@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">New paid order {{ $order->order_number }}</h2>
<p>{{ $order->ship_name }} &lt;{{ $order->email }}&gt; · placed from {{ $order->placed_from }} · {{ $order->currency }}</p>
@if($order->stock_issue)
<p style="color:#b00020;"><strong>Stock issue:</strong> at least one product went below zero stock.</p>
@endif
@include('emails.partials.order-summary')
@include('emails.partials.button', ['url' => url('/admin/orders/'.$order->order_number), 'label' => 'Open in admin'])
@endsection
