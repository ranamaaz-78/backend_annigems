// Small shared helpers.
export const STATUS_OPTIONS = ['pending_payment', 'paid', 'payment_failed', 'cancelled', 'refunded', 'partially_refunded'].map((v) => ({ value: v, label: v.replace(/_/g, ' ') }));
export const STAGE_OPTIONS = [
    { value: 'placed', label: 'Placed' },
    { value: 'crafting', label: 'Crafting' },
    { value: 'quality_check', label: 'Quality check' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
];
export const B2B_STATUS_OPTIONS = ['awaiting_approval', 'confirmed', 'cancelled'].map((v) => ({ value: v, label: v.replace(/_/g, ' ') }));
/** Any B2B screen access (sales person, viewer or manager). */
export const B2B_ANY = ['b2b.view', 'b2b.sales', 'b2b.manage'];
export const stageLabel =(s) => STAGE_OPTIONS.find((o) => o.value === s)?.label || s || '—';
/** Current value of a CSS custom property (charts need real colours, not var()). */
export const cssVar = (name, fallback) => (typeof window !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;
/** Brand chart colours from the logo: primary gold + a second tone that reads in both themes. */
export const chartColors = (dark) => ({ primary: cssVar('--primary', '#AB7117'), second: dark ? '#F6D051' : '#814404' });
export const percent =(r) => `${Math.round(r * 10000) / 100}%`;
