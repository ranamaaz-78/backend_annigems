import { lazy } from 'react';

// Authenticated admin screens: path → component (+ required permission).
const routes = [
    { path: '/', perm: 'dashboard.view', component: lazy(() => import('./pages/Dashboard')) },
    { path: '/profile', component: lazy(() => import('./pages/system/Profile')) },

    { path: '/orders', perm: 'orders.view', component: lazy(() => import('./pages/orders/OrdersList')) },
    { path: '/orders/:number', perm: 'orders.view', component: lazy(() => import('./pages/orders/OrderDetail')) },
    { path: '/customers', perm: 'customers.view', component: lazy(() => import('./pages/customers/CustomersList')) },
    { path: '/customers/:id', perm: 'customers.view', component: lazy(() => import('./pages/customers/CustomerDetail')) },

    { path: '/products', perm: 'catalog.manage', component: lazy(() => import('./pages/catalog/ProductsList')) },
    { path: '/products/:id', perm: 'catalog.manage', component: lazy(() => import('./pages/catalog/ProductForm')) },
    { path: '/categories', perm: 'catalog.manage', component: lazy(() => import('./pages/catalog/Categories')) },
    { path: '/reviews', perm: 'catalog.manage', component: lazy(() => import('./pages/catalog/Reviews')) },

    { path: '/configurator/rings', perm: 'configurator.manage', component: lazy(() => import('./pages/configurator/Rings')) },
    { path: '/configurator/stones', perm: 'configurator.manage', component: lazy(() => import('./pages/configurator/Stones')) },
    { path: '/configurator/combos', perm: 'configurator.manage', component: lazy(() => import('./pages/configurator/Combos')) },
    { path: '/configurator/preview', perm: 'configurator.manage', component: lazy(() => import('./pages/configurator/PricePreview')) },

    { path: '/pricing/gold', perm: 'pricing.manage', component: lazy(() => import('./pages/pricing/GoldRate')) },
    { path: '/pricing/currencies', perm: 'pricing.manage', component: lazy(() => import('./pages/pricing/Currencies')) },
    { path: '/pricing/commerce', perm: 'pricing.manage', component: lazy(() => import('./pages/pricing/Commerce')) },
    { path: '/pricing/shipping-methods', perm: 'pricing.manage', component: lazy(() => import('./pages/pricing/ShippingMethods')) },
    { path: '/pricing/countries', perm: 'pricing.manage', component: lazy(() => import('./pages/pricing/Countries')) },
    { path: '/coupons', perm: 'coupons.manage', component: lazy(() => import('./pages/Coupons')) },
];

export default routes;
