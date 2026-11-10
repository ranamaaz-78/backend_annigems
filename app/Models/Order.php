<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Order extends Model
{
    use LogsActivity;

    // awaiting_approval / confirmed: B2B (cash on delivery) orders before and after staff approval.
    public const STATUSES = ['pending_payment', 'paid', 'payment_failed', 'cancelled', 'refunded', 'partially_refunded', 'awaiting_approval', 'confirmed'];

    /** Statuses on which fulfilment stages can move. */
    public const FULFILLABLE = ['paid', 'partially_refunded', 'confirmed'];

    public const STAGES = ['placed', 'crafting', 'quality_check', 'shipped', 'delivered'];

    public const NUMBER_START = 10001;

    protected $guarded = ['id'];

    protected $casts = [
        'exchange_rate' => 'decimal:8',
        'subtotal' => 'integer',
        'discount' => 'integer',
        'shipping' => 'integer',
        'tax' => 'integer',
        'total' => 'integer',
        'total_eur' => 'integer',
        'tax_rate' => 'float',
        'refunded_amount' => 'integer',
        'coupon_snapshot' => 'array',
        'stock_issue' => 'boolean',
        'paid_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'approved_at' => 'datetime',
        'commission_rate' => 'float',
        'commission_base' => 'integer',
        'commission_amount' => 'integer',
        'commission_amount_eur' => 'integer',
    ];

    protected static function booted(): void
    {
        // AG-10001, AG-10002… derived from the auto-increment id (unique, gap-free per insert).
        static::created(function (Order $order) {
            if (! $order->order_number) {
                $order->order_number = 'AG-'.(static::NUMBER_START - 1 + $order->id);
                $order->saveQuietly();
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function history(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(OrderNote::class)->latest('id');
    }

    public function isPayable(): bool
    {
        return in_array($this->status, ['pending_payment', 'payment_failed'], true);
    }

    public function isPaidLike(): bool
    {
        return in_array($this->status, ['paid', 'partially_refunded', 'refunded', 'confirmed'], true);
    }

    public function isBusiness(): bool
    {
        return $this->account_type === 'business';
    }

    /** B2B commission state: pending (not delivered yet), earned (delivered), void (cancelled). Null for retail orders. */
    public function commissionState(): ?string
    {
        if (! $this->isBusiness() || $this->commission_amount === null) {
            return null;
        }
        if ($this->status === 'cancelled') {
            return 'void';
        }

        return $this->stage === 'delivered' ? 'earned' : 'pending';
    }

    public function salesRep(): BelongsTo
    {
        return $this->belongsTo(AdminUser::class, 'sales_rep_id');
    }

    public function getRouteKeyName(): string
    {
        return 'order_number';
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['status', 'stage', 'carrier', 'tracking_number', 'tracking_url', 'refunded_amount', 'cancel_reason'])
            ->logOnlyDirty()->dontSubmitEmptyLogs()->useLogName('orders');
    }
}
