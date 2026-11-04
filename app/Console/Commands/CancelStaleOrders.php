<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\Setting;
use App\Services\OrderService;
use Illuminate\Console\Command;
use Throwable;

class CancelStaleOrders extends Command
{
    protected $signature = 'orders:cancel-stale';

    protected $description = 'Cancel pending_payment orders older than orders.pending_ttl_hours (default 24)';

    public function handle(OrderService $orders): int
    {
        $hours = max(1, (int) Setting::get('orders.pending_ttl_hours', 24));
        $count = 0;
        Order::where('status', 'pending_payment')->where('created_at', '<', now()->subHours($hours))
            ->orderBy('id')->each(function (Order $order) use ($orders, &$count) {
                try {
                    $orders->cancelUnpaid($order, 'Payment not completed within the time limit');
                    $count++;
                } catch (Throwable $e) {
                    report($e);
                }
            });
        $this->info("Cancelled {$count} stale order(s).");

        return self::SUCCESS;
    }
}
