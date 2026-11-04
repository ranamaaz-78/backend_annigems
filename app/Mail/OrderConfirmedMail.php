<?php

namespace App\Mail;

use App\Models\Order;

class OrderConfirmedMail extends BrandedMail
{
    protected string $template = 'customer.order-confirmed';

    public function __construct(public Order $order) {}

    protected function subjectLine(): string
    {
        return 'Order confirmed: '.$this->order->order_number;
    }
}
