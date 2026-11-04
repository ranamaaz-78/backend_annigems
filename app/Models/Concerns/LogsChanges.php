<?php

namespace App\Models\Concerns;

use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** Audit log for admin-managed models (who changed what). */
trait LogsChanges
{
    use LogsActivity;

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logUnguarded()
            ->logExcept(['created_at', 'updated_at', 'deleted_at'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName(property_exists($this, 'activityLogName') ? $this->activityLogName : $this->getTable());
    }
}
