<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $brand ?? config('app.name') }}</title>
</head>
<body style="margin:0;padding:0;background:#f6f1e7;font-family:Georgia,'Times New Roman',serif;color:#2b2118;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e7;padding:24px 0;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:6px;overflow:hidden;">
    <tr><td style="background:#1c1a17;padding:22px 28px;text-align:center;">
      <span style="color:#d4af37;font-size:22px;letter-spacing:4px;font-weight:bold;">AANI GEMAS</span>
    </td></tr>
    <tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2b2118;">
      @yield('content')
    </td></tr>
    <tr><td style="background:#faf6ee;padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7a6d5c;text-align:center;">
      Handcrafted fine jewelry · <a href="{{ $storefrontUrl ?? config('services.storefront.url') }}" style="color:#a8862a;">{{ preg_replace('#^https?://#', '', $storefrontUrl ?? config('services.storefront.url')) }}</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
