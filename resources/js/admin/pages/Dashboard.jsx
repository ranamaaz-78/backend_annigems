import { Page, Callout } from '../components/ui';
import { useAuth } from '../auth';

export default function Dashboard() {
    const { user } = useAuth();
    return (
        <Page title="Dashboard">
            <Callout type="info" title={`Welcome, ${user.name}`}>The dashboard widgets arrive with the commerce milestones.</Callout>
        </Page>
    );
}
