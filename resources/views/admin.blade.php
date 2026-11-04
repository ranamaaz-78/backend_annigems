<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name') }} · Admin</title>
    <link rel="icon" href="/storage/images/logo_aani.png">
    @viteReactRefresh
    @vite('resources/js/admin/main.jsx')
</head>
<body class="layout-fixed sidebar-expand-lg bg-body-tertiary">
    <div id="admin-root"></div>
</body>
</html>
