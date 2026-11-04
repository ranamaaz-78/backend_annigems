<?php

namespace App\Mail;

use App\Models\Order;
use App\Services\CurrencyService;

class NewPaidOrder extends BrandedMail
{
    protected string $template = 'staff.new-paid-order';

    public function __construct(public Order $order) {}

    protected function subjectLine(): string
    {
        return 'New paid order '.$this->order->order_number.' ('.app(CurrencyService::class)->format($this->order->total, $this->order->currency).')';
    }
}
