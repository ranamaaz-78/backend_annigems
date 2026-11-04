import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable, { FilterBar } from '../../components/DataTable';
import { ActiveBadge, Card, Page, eur, formatDate } from '../../components/ui';

export default function CustomersList() {
    const navigate = useNavigate();
    const [f, setF] = useState({ q: '', is_active: '', with_deleted: '' });
    const columns = [
        { key: 'id', label: '#', sortable: true },
        { key: 'first_name', label: 'Name', sortable: true, render: (u) => <>{u.name} {u.google_linked && <i className="bi bi-google text-secondary" title="Google" />}</> },
        { key: 'email', label: 'Email', sortable: true },
        { key: 'orders_count', label: 'Orders', sortable: true, className: 'text-center' },
        { key: 'lifetime_value_eur', label: 'Lifetime value', sortable: true, className: 'text-end', render: (u) => eur(u.lifetime_value_eur) },
        { key: 'is_active', label: 'Status', render: (u) => (u.deleted ? <span className="badge text-bg-dark">deleted</span> : <ActiveBadge active={u.is_active} />) },
        { key: 'created_at', label: 'Joined', sortable: true, render: (u) => <span className="small">{formatDate(u.created_at, false)}</span> },
        { key: 'last_login_at', label: 'Last login', sortable: true, render: (u) => <span className="small">{formatDate(u.last_login_at)}</span> },
    ];
    return (
        <Page title="Customers" crumbs={[{ label: 'Customers' }]}>
            <Card noBody>
                <div className="p-3 border-bottom">
                    <FilterBar>
                        <div className="col-md-4"><input className="form-control form-control-sm" placeholder="Name, email or phone" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
                        <div className="col-md-2">
                            <select className="form-select form-select-sm" value={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.value })}>
                                <option value="">All</option><option value="1">Active</option><option value="0">Inactive</option>
                            </select>
                        </div>
                        <div className="col-md-auto form-check ms-2">
                            <input type="checkbox" className="form-check-input" id="wd" checked={!!f.with_deleted} onChange={(e) => setF({ ...f, with_deleted: e.target.checked ? 1 : '' })} />
                            <label htmlFor="wd" className="form-check-label small">Include deleted</label>
                        </div>
                    </FilterBar>
                </div>
                <DataTable url="/customers" columns={columns} filters={f} defaultSort="-id" onRowClick={(u) => navigate(`/customers/${u.id}`)} />
            </Card>
        </Page>
    );
}
