@extends('admin.print-layout')
@section('title', 'Packing slip '.$order->order_number)
@section('body')
<div class="grid">
  <div><h1>AANI GEMAS</h1><div class="muted">Packing slip</div></div>
  <div class="right"><h2 style="margin:0;">{{ $order->order_number }}</h2><div class="muted">{{ $order->created_at->format('d M Y') }} · {{ $order->shipping_method_name }}</div></div>
</div>
<div class="grid">
  <div><strong>Ship to</strong><br>{{ $order->ship_name }}<br>{{ $order->ship_line1 }}<br>{{ $order->ship_city }}{{ $order->ship_state ? ', '.$order->ship_state : '' }} {{ $order->ship_zip }}<br>{{ $order->ship_country }}@if($order->ship_phone)<br>{{ $order->ship_phone }}@endif</div>
  <div class="right">@if($order->tracking_number)<strong>{{ $order->carrier }}</strong><br>{{ $order->tracking_number }}@endif</div>
</div>
<table>
  <thead><tr><th>✓</th><th>Item</th><th>Size</th><th class="right">Qty</th></tr></thead>
  <tbody>
  @foreach($order->items as $item)
    <tr><td>☐</td><td>{{ $item->name }}@if($item->kind === 'custom_ring')<br><span class="muted">{{ $item->snapshot['setting'] }} · {{ $item->snapshot['karat'] }}K {{ $item->snapshot['metal_color'] }} · {{ $item->snapshot['stone_name'] }}</span>@elseif(!empty($item->snapshot['sku']))<br><span class="muted">SKU {{ $item->snapshot['sku'] }}</span>@endif</td><td>{{ $item->size ?? '—' }}</td><td class="right">{{ $item->qty }}</td></tr>
  @endforeach
  </tbody>
</table>
@if($order->customer_note)<p><strong>Customer note:</strong> {{ $order->customer_note }}</p>@endif
@endsection
