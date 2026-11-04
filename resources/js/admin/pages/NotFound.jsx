import { Link } from 'react-router-dom';
import { Page } from '../components/ui';

export default function NotFound() {
    return (
        <Page title="Not found">
            <div className="error-page text-center py-5">
                <h2 className="text-warning">404</h2>
                <p>This page does not exist or you do not have access. <Link to="/">Back to dashboard</Link></p>
            </div>
        </Page>
    );
}
