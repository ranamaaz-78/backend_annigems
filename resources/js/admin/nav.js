// Sidebar menu. `perm` hides entries the staff user cannot access.
const nav = [
    { header: 'MAIN' },
    { label: 'Dashboard', to: '/', icon: 'bi-speedometer', perm: 'dashboard.view' },
    { label: 'Orders', to: '/orders', icon: 'bi-bag-check', perm: 'orders.view' },
    { label: 'Customers', to: '/customers', icon: 'bi-people', perm: 'customers.view' },
    { header: 'CATALOG' },
    {
        label: 'Catalog', icon: 'bi-gem', perm: 'catalog.manage',
        children: [
            { label: 'Products', to: '/products' },
            { label: 'Categories', to: '/categories' },
            { label: 'Reviews', to: '/reviews' },
        ],
    },
    {
        label: 'Design Your Ring', icon: 'bi-stars', perm: 'configurator.manage',
        children: [
            { label: 'Rings', to: '/configurator/rings' },
            { label: 'Stones', to: '/configurator/stones' },
            { label: 'Combos matrix', to: '/configurator/combos' },
            { label: 'Price preview', to: '/configurator/preview' },
            { label: 'Size guide', to: '/configurator/size-guide' },
        ],
    },
    { header: 'COMMERCE' },
    {
        label: 'Pricing & settings', icon: 'bi-currency-exchange', perm: 'pricing.manage',
        children: [
            { label: 'Gold rate', to: '/pricing/gold' },
            { label: 'Currencies', to: '/pricing/currencies' },
            { label: 'Tax & shipping', to: '/pricing/commerce' },
            { label: 'Shipping methods', to: '/pricing/shipping-methods' },
            { label: 'Countries', to: '/pricing/countries' },
        ],
    },
    { label: 'Coupons', to: '/coupons', icon: 'bi-ticket-perforated', perm: 'coupons.manage' },
    { header: 'CONTENT' },
    {
        label: 'Content', icon: 'bi-layout-text-window', perm: 'content.manage',
        children: [
            { label: 'Content blocks', to: '/content/blocks' },
            { label: 'Policy pages', to: '/content/pages' },
            { label: 'FAQs', to: '/content/faqs' },
            { label: 'Testimonials', to: '/content/testimonials' },
        ],
    },
    {
        label: 'Messages', icon: 'bi-envelope', perm: 'messages.manage',
        children: [
            { label: 'Contact inbox', to: '/messages' },
            { label: 'Newsletter', to: '/newsletter' },
        ],
    },
    { header: 'SYSTEM' },
    { label: 'Staff & roles', to: '/staff', icon: 'bi-person-badge', perm: 'staff.manage' },
    { label: 'Activity log', to: '/activity', icon: 'bi-clock-history', perm: 'activity.view' },
    { label: 'App settings', to: '/settings', icon: 'bi-gear', perm: 'settings.manage' },
];

export default nav;
