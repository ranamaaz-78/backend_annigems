// Sidebar menu (keenicons). `perm` hides entries the staff user cannot access.
const nav = [
    { header: 'Main' },
    { label: 'Dashboard', to: '/', icon: 'element-11', perm: 'dashboard.view' },
    { label: 'Orders', to: '/orders', icon: 'handcart', perm: 'orders.view' },
    { label: 'Customers', to: '/customers', icon: 'users', perm: 'customers.view' },
    { header: 'Catalog' },
    {
        label: 'Catalog', icon: 'diamonds', perm: 'catalog.manage',
        children: [
            { label: 'Products', to: '/products' },
            { label: 'Categories', to: '/categories' },
            { label: 'Reviews', to: '/reviews' },
        ],
    },
    {
        label: 'Design Your Ring', icon: 'crown', perm: 'configurator.manage',
        children: [
            { label: 'Rings', to: '/configurator/rings' },
            { label: 'Stones', to: '/configurator/stones' },
            { label: 'Combos matrix', to: '/configurator/combos' },
            { label: 'Price preview', to: '/configurator/preview' },
            { label: 'Size guide', to: '/configurator/size-guide' },
        ],
    },
    { header: 'Commerce' },
    {
        label: 'Pricing & settings', icon: 'dollar', perm: 'pricing.manage',
        children: [
            { label: 'Gold rate', to: '/pricing/gold' },
            { label: 'Currencies', to: '/pricing/currencies' },
            { label: 'Tax & shipping', to: '/pricing/commerce' },
            { label: 'Shipping methods', to: '/pricing/shipping-methods' },
            { label: 'Countries', to: '/pricing/countries' },
        ],
    },
    { label: 'Coupons', to: '/coupons', icon: 'discount', perm: 'coupons.manage' },
    { header: 'Content' },
    {
        label: 'Content', icon: 'notepad-edit', perm: 'content.manage',
        children: [
            { label: 'Content blocks', to: '/content/blocks' },
            { label: 'Policy pages', to: '/content/pages' },
            { label: 'FAQs', to: '/content/faqs' },
            { label: 'Testimonials', to: '/content/testimonials' },
        ],
    },
    {
        label: 'Messages', icon: 'messages', perm: 'messages.manage',
        children: [
            { label: 'Contact inbox', to: '/messages' },
            { label: 'Newsletter', to: '/newsletter' },
        ],
    },
    { header: 'System' },
    {
        label: 'Staff & roles', icon: 'security-user', perm: 'staff.manage',
        children: [
            { label: 'Staff', to: '/staff' },
            { label: 'Roles & permissions', to: '/roles' },
        ],
    },
    { label: 'Activity log', to: '/activity', icon: 'time', perm: 'activity.view' },
    { label: 'App settings', to: '/settings', icon: 'setting-2', perm: 'settings.manage' },
];

const B2B_ANY = ['b2b.view', 'b2b.sales', 'b2b.manage'];

/** B2B mode sidebar (header switch B2C | B2B). Sales persons only ever see this one. */
export const b2bNav = [
    { header: 'B2B' },
    { label: 'Dashboard', to: '/b2b', icon: 'element-11', perm: B2B_ANY },
    { label: 'B2B orders', to: '/b2b/orders', icon: 'handcart', perm: B2B_ANY },
    { label: 'Businesses', to: '/b2b/businesses', icon: 'shop', perm: B2B_ANY },
    { label: 'Commissions', to: '/b2b/commissions', icon: 'percentage', perm: B2B_ANY },
    { label: 'Payouts', to: '/b2b/payouts', icon: 'wallet', perm: [...B2B_ANY, 'b2b.payouts'] },
    { header: 'Setup' },
    { label: 'Sales persons', to: '/b2b/sales-reps', icon: 'people', perm: ['b2b.view', 'b2b.manage', 'b2b.payouts'] },
    { label: 'Membership tiers', to: '/b2b/tiers', icon: 'crown-2', perm: 'b2b.manage' },
];

export const b2bQuickCreate = [
    { label: 'Business', to: '/b2b/businesses?new=1', icon: 'shop', perm: ['b2b.sales', 'b2b.manage'] },
    { label: 'Sales person', to: '/b2b/sales-reps?new=1', icon: 'people', perm: 'b2b.manage' },
];

/** Quick-create shortcuts for the sidebar "Add New" button. */
export const quickCreate = [
    { label: 'Product', to: '/products/new', icon: 'diamonds', perm: 'catalog.manage' },
    { label: 'Coupon', to: '/coupons?new=1', icon: 'discount', perm: 'coupons.manage' },
    { label: 'Ring setting', to: '/configurator/rings?new=1', icon: 'crown', perm: 'configurator.manage' },
    { label: 'Stone', to: '/configurator/stones?new=1', icon: 'color-swatch', perm: 'configurator.manage' },
    { label: 'Testimonial', to: '/content/testimonials?new=1', icon: 'like', perm: 'content.manage' },
    { label: 'Staff member', to: '/staff?new=1', icon: 'user', perm: 'staff.manage' },
];

export default nav;
