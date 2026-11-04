import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable, { FilterBar, SearchInput } from '../../components/DataTable';
import { ActiveBadge, Icon, Initials, Page, eur, formatDate } from '../../components/ui';

export default function CustomersList() {
    const navigate = useNavigate();
    const [f, setF] = useState({ q: '', is_active: '', with_deleted: '' });
    const columns = [
        { key: 'first_name', label: 'Customer', sortable: true, render: (u) => (
            <div className="flex items-center gap-2.5">
                <Initials name={u.name} />
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-mono flex items-center gap-1.5">{u.name} {u.google_linked && <Icon name="google" className="text-xs text-muted-foreground" />}</span>
                    <span className="text-xs text-secondary-foreground">{u.email}</span>
                </div>
            </div>
        ) },
        { key: 'orders_count', label: 'Orders', sortable: true, className: 'text-center' },
        { key: 'lifetime_value_eur', label: 'Lifetime value', sortable: true, className: 'text-end', render: (u) => <span className="text-sm font-medium text-mono">{eur(u.lifetime_value_eur)}</span> },
        { key: 'preferred_currency', label: 'Currency', render: (u) => <span className="kt-badge kt-badge-sm kt-badge-outline">{u.preferred_currency || 'EUR'}</span> },
        { key: 'is_active', label: 'Status', render: (u) => (u.deleted ? <span className="kt-badge kt-badge-mono kt-badge-outline">deleted</span> : <ActiveBadge active={u.is_active} />) },
        { key: 'created_at', label: 'Joined', sortable: true, render: (u) => <span className="text-sm text-secondary-foreground whitespace-nowrap">{formatDate(u.created_at, false)}</span> },
        { key: 'last_login_at', label: 'Last login', sortable: true, render: (u) => <span className="text-sm text-secondary-foreground whitespace-nowrap">{formatDate(u.last_login_at)}</span> },
    ];
    return (
        <Page title="Customers" crumbs={[{ label: 'Customers' }]}>
            <div className="kt-card kt-card-grid min-w-full">
                <div className="kt-card-header py-3 flex-wrap gap-3">
                    <h3 className="kt-card-title">All customers</h3>
                    <FilterBar>
                        <SearchInput value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Name, email or phone" />
                        <select className="kt-select w-36" value={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.value })}>
                            <option value="">All</option><option value="1">Active</option><option value="0">Inactive</option>
                        </select>
                        <label className="flex items-center gap-2 text-sm text-secondary-foreground cursor-pointer">
                            <input type="checkbox" className="kt-checkbox kt-checkbox-sm" checked={!!f.with_deleted} onChange={(e) => setF({ ...f, with_deleted: e.target.checked ? 1 : '' })} /> Include deleted
                        </label>
                    </FilterBar>
                </div>
                <div className="kt-card-table">
                    <DataTable url="/customers" columns={columns} filters={f} defaultSort="-id" onRowClick={(u) => navigate(`/customers/${u.id}`)} empty="No customers found." />
                </div>
            </div>
        </Page>
    );
}
