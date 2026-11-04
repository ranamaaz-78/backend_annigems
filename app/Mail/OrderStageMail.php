<?php

namespace App\Mail;

use App\Models\Order;

class OrderStageMail extends BrandedMail
{
    protected string $template = 'customer.order-stage';

    public function __construct(public Order $order, public string $stage) {}

    protected function subjectLine(): string
    {
        return match ($this->stage) {
            'crafting' => 'Your piece is being crafted: '.$this->order->order_number,
            'quality_check' => 'Quality check under way: '.$this->order->order_number,
            'shipped' => 'Your order has shipped: '.$this->order->order_number,
            'delivered' => 'Delivered: '.$this->order->order_number,
            default => 'Order update: '.$this->order->order_number,
        };
    }
}
