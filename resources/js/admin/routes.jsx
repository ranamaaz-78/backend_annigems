import { lazy } from 'react';

// Authenticated admin screens: path → component (+ required permission).
const routes = [
    { path: '/', perm: 'dashboard.view', component: lazy(() => import('./pages/Dashboard')) },
    { path: '/profile', component: lazy(() => import('./pages/system/Profile')) },
];

export default routes;
