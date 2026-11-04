import { useState } from 'react';
import api, { download } from '../../api';
import DataTable, { SearchInput } from '../../components/DataTable';
import { Icon, Page, Tabs, formatDate } from '../../components/ui';

export default function Newsletter() {
    const [f, setF] = useState({ q: '', status: 'active' });
    const [reload, setReload] = useState(0);
    const columns = [
        { key: 'email', label: 'Email', render: (s) => <span className="flex items-center gap-2 text-sm text-mono"><Icon name="sms" className="text-muted-foreground" />{s.email}</span> },
        { key: 'source', label: 'Source', render: (s) => <span className="kt-badge kt-badge-sm kt-badge-outline"><Icon name={s.source === 'mobile' ? 'tablet' : 'screen'} /> {s.source}</span> },
        { key: 'subscribed_at', label: 'Subscribed', render: (s) => <span className="text-sm text-secondary-foreground">{formatDate(s.subscribed_at)}</span> },
        { key: 'unsubscribed_at', label: 'Unsubscribed', render: (s) => <span className="text-sm text-secondary-foreground">{s.unsubscribed_at ? formatDate(s.unsubscribed_at) : '—'}</span> },
        {
            key: 'a', label: '', className: 'text-end w-[1%] whitespace-nowrap', render: (s) => (
                <div className="inline-flex gap-1">
                    {!s.unsubscribed_at && <button className="kt-btn kt-btn-sm kt-btn-outline" onClick={async () => { await api.post(`/newsletter/${s.id}/unsubscribe`); setReload((r) => r + 1); }}>Unsubscribe</button>}
                    <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost text-destructive" onClick={async () => { if (window.confirm('Delete this email?')) { await api.delete(`/newsletter/${s.id}`); setReload((r) => r + 1); } }}><Icon name="trash" /></button>
                </div>
            ),
        },
    ];
    return (
        <Page title="Newsletter" crumbs={[{ label: 'Messages' }, { label: 'Newsletter' }]}
            actions={<button className="kt-btn kt-btn-outline" onClick={() => download('/newsletter-export', f, 'newsletter.csv')}><Icon name="exit-down" /> Export CSV</button>}>
            <div className="kt-card kt-card-grid min-w-full">
                <div className="kt-card-header py-3 flex-wrap gap-3">
                    <Tabs className="border-b-0" tabs={[{ value: 'active', label: 'Subscribed' }, { value: 'unsubscribed', label: 'Unsubscribed' }, { value: '', label: 'All' }]} value={f.status} onChange={(v) => setF({ ...f, status: v })} />
                    <SearchInput value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Search email" />
                </div>
                <div className="kt-card-table">
                    <DataTable url="/newsletter" columns={columns} filters={f} reloadKey={reload} empty="No subscribers yet." />
                </div>
            </div>
        </Page>
    );
}
