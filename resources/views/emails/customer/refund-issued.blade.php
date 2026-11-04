@extends('emails.layout')
@section('content')
<h2 style="margin-top:0;">Refund issued</h2>
<p>We have refunded <strong>{{ app(\App\Services\CurrencyService::class)->format($amount, $order->currency) }}</strong> for order <strong>{{ $order->order_number }}</strong> to your original card. Depending on your bank it can take 5–10 business days to appear.</p>
@if($order->status === 'partially_refunded')
<p>Total refunded so far: {{ app(\App\Services\CurrencyService::class)->format($order->refunded_amount, $order->currency) }} of {{ app(\App\Services\CurrencyService::class)->format($order->total, $order->currency) }}.</p>
@endif
@include('emails.partials.button', ['url' => $storefrontUrl.'/account/orders/'.$order->order_number, 'label' => 'View order'])
@endsection
