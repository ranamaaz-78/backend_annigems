import { useEffect } from 'react';

/** AdminLTE login-box wrapper used by every unauthenticated screen. */
export default function AuthBox({ message, children, wide }) {
    useEffect(() => {
        document.body.className = 'login-page bg-body-secondary';
        return () => {
            document.body.className = 'layout-fixed sidebar-expand-lg bg-body-tertiary';
        };
    }, []);
    return (
        <main className="login-box" style={wide ? { width: 460, maxWidth: '95vw' } : undefined}>
            <div className="card card-outline card-primary">
                <div className="card-header text-center">
                    <h1 className="mb-0 fs-2"><b>AANI</b> GEMAS</h1>
                    <small className="text-secondary">Admin panel</small>
                </div>
                <div className="card-body login-card-body">
                    {message && <p className="login-box-msg">{message}</p>}
                    {children}
                </div>
            </div>
        </main>
    );
}
