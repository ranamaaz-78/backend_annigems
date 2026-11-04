import { useState } from 'react';
import api, { download } from '../../api';
import DataTable from '../../components/DataTable';
import { Card, Page, formatDate } from '../../components/ui';

export default function Newsletter() {
    const [f, setF] = useState({ q: '', status: 'active' });
    const [reload, setReload] = useState(0);
    const columns = [
        { key: 'email', label: 'Email' },
        { key: 'source', label: 'Source', render: (s) => <span className="badge text-bg-light border">{s.source}</span> },
        { key: 'subscribed_at', label: 'Subscribed', render: (s) => formatDate(s.subscribed_at) },
        { key: 'unsubscribed_at', label: 'Unsubscribed', render: (s) => (s.unsubscribed_at ? formatDate(s.unsubscribed_at) : '—') },
        {
            key: 'a', label: '', className: 'text-end', render: (s) => (
                <div className="btn-group btn-group-sm">
                    {!s.unsubscribed_at && <button className="btn btn-outline-secondary" onClick={async () => { await api.post(`/newsletter/${s.id}/unsubscribe`); setReload((r) => r + 1); }}>Unsubscribe</button>}
                    <button className="btn btn-outline-danger" onClick={async () => { if (window.confirm('Delete this email?')) { await api.delete(`/newsletter/${s.id}`); setReload((r) => r + 1); } }}><i className="bi bi-trash" /></button>
                </div>
            ),
        },
    ];
    return (
        <Page title="Newsletter subscribers" crumbs={[{ label: 'Messages' }, { label: 'Newsletter' }]}>
            <Card noBody
                title={<div className="d-flex gap-2">
                    <input className="form-control form-control-sm" style={{ width: 240 }} placeholder="Search email…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
                    <select className="form-select form-select-sm" style={{ width: 160 }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                        <option value="active">Subscribed</option><option value="unsubscribed">Unsubscribed</option><option value="">All</option>
                    </select>
                </div>}
                tools={<button className="btn btn-sm btn-outline-success" onClick={() => download('/newsletter-export', f, 'newsletter.csv')}><i className="bi bi-filetype-csv" /> Export CSV</button>}>
                <DataTable url="/newsletter" columns={columns} filters={f} reloadKey={reload} />
            </Card>
        </Page>
    );
}
