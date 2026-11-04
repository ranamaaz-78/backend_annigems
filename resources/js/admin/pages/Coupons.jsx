import CrudPage, { ActiveBadge } from '../components/CrudPage';
import { eur, formatDate } from '../components/ui';

export default function Coupons() {
    return (
        <CrudPage
            title="Coupons"
            crumbs={[{ label: 'Coupons' }]}
            url="/coupons"
            defaultSort="-id"
            newItem={{ type: 'percent', value: 10, is_active: true }}
            transformOut={(v) => ({ ...v, min_subtotal: v.min_subtotal || null, usage_limit: v.usage_limit || null, per_user_limit: v.per_user_limit || null, starts_at: v.starts_at || null, expires_at: v.expires_at || null })}
            columns={[
                { key: 'code', label: 'Code', sortable: true, render: (c) => <><strong>{c.code}</strong><div className="text-xs text-secondary-foreground">{c.label}</div></> },
                { key: 'value', label: 'Discount', render: (c) => (c.type === 'percent' ? `${c.value}%` : eur(c.value)) },
                { key: 'min_subtotal', label: 'Min. order', render: (c) => (c.min_subtotal ? eur(c.min_subtotal) : '—') },
                { key: 'expires_at', label: 'Valid', sortable: true, render: (c) => <span className="text-sm">{c.starts_at ? formatDate(c.starts_at, false) : '…'} → {c.expires_at ? formatDate(c.expires_at, false) : '…'}</span> },
                { key: 'used_count', label: 'Used', sortable: true, render: (c) => `${c.used_count}${c.usage_limit ? ` / ${c.usage_limit}` : ''}` },
                { key: 'stats', label: 'Revenue (paid)', className: 'text-end', render: (c) => <>{eur(c.stats.revenue_eur)}<div className="text-xs text-secondary-foreground">−{eur(c.stats.discount_eur)} discount · {c.stats.paid_orders} orders</div></> },
                { key: 'is_active', label: 'Status', render: (c) => <ActiveBadge active={c.is_active} /> },
            ]}
            fields={[
                { key: 'code', label: 'Code', col: 'md:col-span-6', help: 'Stored uppercase.' },
                { key: 'label', label: 'Label', col: 'md:col-span-6', help: 'Shown to the customer, e.g. "10% off your order".' },
                { key: 'type', label: 'Type', type: 'select', options: [{ value: 'percent', label: 'Percent' }, { value: 'fixed', label: 'Fixed amount (EUR)' }], col: 'md:col-span-6' },
                { key: 'value', label: 'Percent', type: 'number', col: 'md:col-span-6', hidden: (i) => i.type !== 'percent' },
                { key: 'value', label: 'Amount (EUR)', type: 'money', col: 'md:col-span-6', hidden: (i) => i.type !== 'fixed' },
                { key: 'min_subtotal', label: 'Minimum subtotal (EUR)', type: 'money', nullable: true, col: 'md:col-span-6' },
                { key: 'usage_limit', label: 'Total usage limit', type: 'number', col: 'md:col-span-3' },
                { key: 'per_user_limit', label: 'Per customer', type: 'number', col: 'md:col-span-3' },
                { key: 'starts_at', label: 'Starts', type: 'datetime', col: 'md:col-span-6' },
                { key: 'expires_at', label: 'Expires', type: 'datetime', col: 'md:col-span-6' },
                { key: 'is_active', label: 'Active', type: 'check' },
            ]}
        />
    );
}
