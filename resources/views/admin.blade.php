<!doctype html>
<html lang="en" class="h-full" data-kt-theme="true" data-kt-theme-mode="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name') }} · Admin</title>
    <link rel="icon" href="/storage/images/logo_aani.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script>
        // Theme mode (light | dark | system), same as Metronic.
        (function () {
            var mode = 'light';
            try { mode = localStorage.getItem('kt-theme') || 'light'; } catch (e) {}
            if (mode === 'system') mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.classList.add(mode);
        })();
    </script>
    @viteReactRefresh
    @vite('resources/js/admin/main.jsx')
</head>
<body class="antialiased flex h-full text-base text-foreground bg-background">
    <div id="admin-root" class="flex grow"></div>
</body>
</html>
