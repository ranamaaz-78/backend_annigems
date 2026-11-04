@extends('admin.print-layout')
@section('title', 'Invoice '.$order->order_number)
@section('body')
@php($f = fn ($v) => $fx->format((int) $v, $order->currency))
<div class="grid">
  <div>
    <h1>AANI GEMAS</h1>
    <div class="muted">{{ \App\Models\ContentBlock::value('contact')['address'] ?? '' }}<br>{{ \App\Models\ContentBlock::value('contact')['email'] ?? '' }}</div>
  </div>
  <div class="right">
    <h2 style="margin:0;">INVOICE</h2>
    <div>{{ $order->order_number }}</div>
    <div class="muted">Date: {{ ($order->paid_at ?? $order->created_at)->format('d M Y') }}<br>Status: {{ str_replace('_', ' ', $order->status) }}</div>
  </div>
</div>
<div class="grid">
  <div><strong>Bill / ship to</strong><br>{{ $order->ship_name }}<br>{{ $order->ship_line1 }}<br>{{ $order->ship_city }}{{ $order->ship_state ? ', '.$order->ship_state : '' }} {{ $order->ship_zip }}<br>{{ $order->ship_country }}<br>{{ $order->email }}{{ $order->ship_phone ? ' · '.$order->ship_phone : '' }}</div>
  <div class="right"><strong>Payment</strong><br>Card via Stripe<br><span class="muted">{{ $order->stripe_payment_intent_id }}</span></div>
</div>
<table>
  <thead><tr><th>Item</th><th>Size</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Total</th></tr></thead>
  <tbody>
  @foreach($order->items as $item)
    <tr>
      <td>{{ $item->name }}@if($item->subtitle)<br><span class="muted">{{ $item->subtitle }}</span>@endif
        @if($item->kind === 'custom_ring')<br><span class="muted">{{ $item->snapshot['karat'] }}K · {{ $item->snapshot['gold_weight_g'] }} g gold · {{ $item->snapshot['stone_name'] }}</span>@endif
      </td>
      <td>{{ $item->size ?? '—' }}</td>
      <td class="right">{{ $item->qty }}</td>
      <td class="right">{{ $f($item->unit_price) }}</td>
      <td class="right">{{ $f($item->line_total) }}</td>
    </tr>
  @endforeach
  </tbody>
</table>
<table class="totals" style="width:320px;margin-left:auto;">
  <tr><td>Subtotal</td><td class="right">{{ $f($order->subtotal) }}</td></tr>
  @if($order->discount)<tr><td>Discount ({{ $order->coupon_code }})</td><td class="right">−{{ $f($order->discount) }}</td></tr>@endif
  <tr><td>Shipping ({{ $order->shipping_method_name }})</td><td class="right">{{ $f($order->shipping) }}</td></tr>
  <tr><td>Tax ({{ rtrim(rtrim(number_format($order->tax_rate * 100, 2), '0'), '.') }}%)</td><td class="right">{{ $f($order->tax) }}</td></tr>
  <tr><td><strong>Total</strong></td><td class="right"><strong>{{ $f($order->total) }}</strong></td></tr>
  @if($order->refunded_amount)<tr><td>Refunded</td><td class="right">−{{ $f($order->refunded_amount) }}</td></tr>@endif
</table>
@endsection
