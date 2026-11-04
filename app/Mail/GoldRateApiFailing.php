<?php

namespace App\Mail;

use App\Models\GoldRate;

class GoldRateApiFailing extends BrandedMail
{
    protected string $template = 'staff.gold-rate-failing';

    public function __construct(public int $failures, public string $error, public ?GoldRate $lastGood) {}

    protected function subjectLine(): string
    {
        return "Gold-rate API failing ({$this->failures} consecutive fetches)";
    }
}
