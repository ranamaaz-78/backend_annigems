<?php

namespace App\Mail;

use App\Models\Order;

class B2bOrderReceivedMail extends BrandedMail
{
    protected string $template = 'customer.b2b-order-received';

    public function __construct(public Order $order) {}

    protected function subjectLine(): string
    {
        return 'Order '.$this->order->order_number.' received, awaiting approval';
    }
}
