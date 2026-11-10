<?php

namespace App\Mail;

use App\Models\Order;
use App\Services\CurrencyService;

class NewB2bOrder extends BrandedMail
{
    protected string $template = 'staff.new-b2b-order';

    public function __construct(public Order $order) {}

    protected function subjectLine(): string
    {
        return 'B2B order '.$this->order->order_number.' to approve ('.$this->order->company_name.', '.app(CurrencyService::class)->format($this->order->total, $this->order->currency).')';
    }
}
