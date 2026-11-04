// Small shared helpers.
export const STATUS_OPTIONS = ['pending_payment', 'paid', 'payment_failed', 'cancelled', 'refunded', 'partially_refunded'].map((v) => ({ value: v, label: v.replace(/_/g, ' ') }));
export const STAGE_OPTIONS = [
    { value: 'placed', label: 'Placed' },
    { value: 'crafting', label: 'Crafting' },
    { value: 'quality_check', label: 'Quality check' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
];
export const stageLabel = (s) => STAGE_OPTIONS.find((o) => o.value === s)?.label || s || '—';
export const percent = (r) => `${Math.round(r * 10000) / 100}%`;
