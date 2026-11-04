import { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import AppLayout from './layout/AppLayout';
import routes from './routes';
import { Spinner } from './components/ui';
import Login from './pages/auth/Login';
import TwoFactorSetup from './pages/auth/TwoFactorSetup';
import TwoFactorChallenge from './pages/auth/TwoFactorChallenge';
import { ForgotPassword, ResetPassword } from './pages/auth/ForgotPassword';
import NotFound from './pages/NotFound';

export default function App() {
    const { user, can } = useAuth();
    const location = useLocation();

    if (user === undefined) return <Spinner />;

    if (!user) {
        return (
            <Routes>
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="*" element={<Login />} />
            </Routes>
        );
    }
    if (user.two_factor.required && !user.two_factor.enabled) return <TwoFactorSetup />;
    if (!user.two_factor.passed) return <TwoFactorChallenge />;

    if (['/login', '/forgot-password', '/reset-password'].includes(location.pathname)) return <Navigate to="/" replace />;

    // Staff without dashboard access land on their first allowed screen.
    const home = can('dashboard.view') ? null : routes.find((r) => r.perm && r.path !== '/' && can(r.perm));

    return (
        <Routes>
            <Route element={<AppLayout />}>
                {routes.map((r) => (
                    <Route
                        key={r.path}
                        path={r.path}
                        element={
                            r.path === '/' && home ? <Navigate to={home.path} replace /> : can(r.perm) ? (
                                <Suspense fallback={<Spinner />}><r.component /></Suspense>
                            ) : <NotFound />
                        }
                    />
                ))}
                <Route path="*" element={<NotFound />} />
            </Route>
        </Routes>
    );
}
