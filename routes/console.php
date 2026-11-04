<?php

use Illuminate\Support\Facades\Schedule;

// Rate fetches check their own configurable interval (admin settings) every minute.
Schedule::command('rates:gold')->everyMinute()->withoutOverlapping()->runInBackground();
Schedule::command('rates:fx')->everyMinute()->withoutOverlapping()->runInBackground();

if (file_exists(__DIR__.'/console_orders.php')) {
    require __DIR__.'/console_orders.php';
}
