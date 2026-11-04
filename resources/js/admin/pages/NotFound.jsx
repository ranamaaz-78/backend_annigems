import { Link } from 'react-router-dom';
import { Page } from '../components/ui';

export default function NotFound() {
    return (
        <Page title="Page not found">
            <div className="kt-card">
                <div className="kt-card-content flex flex-col items-center text-center gap-4 py-14">
                    <img src="/admin-assets/media/19.svg" alt="" className="dark:hidden max-h-[160px]" />
                    <img src="/admin-assets/media/19-dark.svg" alt="" className="light:hidden max-h-[160px]" />
                    <span className="kt-badge kt-badge-primary kt-badge-outline">404 Error</span>
                    <h3 className="text-2xl font-semibold text-mono">We have lost this page</h3>
                    <p className="text-sm text-secondary-foreground">It does not exist or you do not have access to it.</p>
                    <Link to="/" className="kt-btn kt-btn-primary">Back to dashboard</Link>
                </div>
            </div>
        </Page>
    );
}
