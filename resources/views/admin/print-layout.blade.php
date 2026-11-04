<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>@yield('title')</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #222; margin: 32px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0; letter-spacing: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th, td { padding: 8px 6px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
  th { background: #f5f2ea; }
  .right { text-align: right; }
  .muted { color: #777; font-size: 12px; }
  .grid { display: flex; justify-content: space-between; gap: 24px; margin-top: 24px; }
  .totals td { border: none; padding: 4px 6px; }
  .noprint { margin-bottom: 18px; }
  @media print { .noprint { display: none; } body { margin: 0; } }
</style>
</head>
<body>
<div class="noprint"><button onclick="window.print()">Print</button></div>
@yield('body')
</body>
</html>
