@php($fmt = fn ($v) => app(\App\Services\CurrencyService::class)->format((int) $v, $order->currency))
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:16px 0;">
@foreach($order->items as $item)
  <tr style="border-bottom:1px solid #eee;">
    <td style="padding:10px 0;vertical-align:top;">
      <strong>{{ $item->name }}</strong>
      @if($item->subtitle)<br><span style="color:#7a6d5c;">{{ $item->subtitle }}</span>@endif
      @if($item->size)<br><span style="color:#7a6d5c;">Size {{ $item->size }}</span>@endif
      @if($item->kind === 'custom_ring')
        @php($s = $item->snapshot)
        <br><span style="color:#7a6d5c;font-size:12px;">
          {{ $s['karat'] }}K gold · {{ $s['gold_weight_g'] }} g · {{ $s['setting'] }} · {{ $s['stone_name'] }}<br>
          Gold €{{ number_format($s['gold_value_eur'] / 100, 2) }} + craft €{{ number_format($s['craft_fee_eur'] / 100, 2) }} + stone €{{ number_format($s['stone_price_eur'] / 100, 2) }}
          (gold at €{{ number_format($s['gold_rate_per_oz_eur'] / 100, 2) }}/oz) · made to order, {{ $s['delivery_text'] }}
        </span>
      @endif
    </td>
    <td style="padding:10px 0;text-align:center;vertical-align:top;white-space:nowrap;">× {{ $item->qty }}</td>
    <td style="padding:10px 0;text-align:right;vertical-align:top;white-space:nowrap;">{{ $fmt($item->line_total) }}</td>
  </tr>
@endforeach
  <tr><td colspan="2" style="padding:6px 0 0;">Subtotal</td><td style="text-align:right;padding:6px 0 0;">{{ $fmt($order->subtotal) }}</td></tr>
  @if($order->discount > 0)
  <tr><td colspan="2">Discount ({{ $order->coupon_code }})</td><td style="text-align:right;">−{{ $fmt($order->discount) }}</td></tr>
  @endif
  <tr><td colspan="2">Shipping ({{ $order->shipping_method_name }})</td><td style="text-align:right;">{{ $order->shipping ? $fmt($order->shipping) : 'Free' }}</td></tr>
  <tr><td colspan="2">Tax</td><td style="text-align:right;">{{ $fmt($order->tax) }}</td></tr>
  <tr><td colspan="2" style="padding-top:6px;"><strong>Total</strong></td><td style="text-align:right;padding-top:6px;"><strong>{{ $fmt($order->total) }}</strong></td></tr>
</table>
<p style="font-size:13px;color:#7a6d5c;">Shipping to: {{ $order->ship_name }}, {{ $order->ship_line1 }}, {{ $order->ship_city }}{{ $order->ship_state ? ', '.$order->ship_state : '' }} {{ $order->ship_zip }}, {{ $order->ship_country }}</p>
