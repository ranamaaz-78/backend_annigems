<?php

namespace App\Support;

/** Central list of staff permissions (admin guard) and the seeded role map. */
class Permissions
{
    public const ALL = [
        'dashboard.view' => 'View dashboard',
        'orders.view' => 'View orders',
        'orders.stage' => 'Update order stage & tracking',
        'orders.manage' => 'Cancel orders, resend emails, notes',
        'orders.refund' => 'Issue refunds',
        'customers.view' => 'View customers',
        'customers.manage' => 'Activate/deactivate customers, send reset codes',
        'catalog.manage' => 'Products, categories, reviews',
        'configurator.manage' => 'Design Your Ring rings, stones, combos',
        'pricing.manage' => 'Gold rate, currencies, tax, shipping, countries',
        'coupons.manage' => 'Coupons',
        'content.manage' => 'Content blocks, pages, FAQs, testimonials',
        'messages.manage' => 'Contact messages and newsletter',
        'staff.manage' => 'Staff, roles and permissions',
        'settings.manage' => 'App settings',
        'activity.view' => 'Activity log',
        'media.upload' => 'Upload images',
    ];

    public const ROLES = [
        'Super Admin' => '*',
        'Manager' => [
            'dashboard.view', 'orders.view', 'orders.stage', 'orders.manage', 'orders.refund',
            'customers.view', 'customers.manage', 'catalog.manage', 'configurator.manage',
            'pricing.manage', 'coupons.manage', 'content.manage', 'messages.manage', 'media.upload',
        ],
        'Support' => [
            'dashboard.view', 'orders.view', 'orders.stage', 'customers.view', 'messages.manage',
        ],
    ];
}
