<?php

namespace App\Mail;

use App\Models\Order;

class PaymentFailedMail extends BrandedMail
{
    protected string $template = 'customer.payment-failed';

    public function __construct(public Order $order, public ?string $reason = null) {}

    protected function subjectLine(): string
    {
        return 'Payment failed for order '.$this->order->order_number;
    }
}
