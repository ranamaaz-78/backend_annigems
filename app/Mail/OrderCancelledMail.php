<?php

namespace App\Mail;

use App\Models\Order;

class OrderCancelledMail extends BrandedMail
{
    protected string $template = 'customer.order-cancelled';

    public function __construct(public Order $order) {}

    protected function subjectLine(): string
    {
        return 'Order '.$this->order->order_number.' cancelled';
    }
}
