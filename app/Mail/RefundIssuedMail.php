<?php

namespace App\Mail;

use App\Models\Order;

class RefundIssuedMail extends BrandedMail
{
    protected string $template = 'customer.refund-issued';

    public function __construct(public Order $order, public int $amount) {}

    protected function subjectLine(): string
    {
        return 'Refund issued for order '.$this->order->order_number;
    }
}
