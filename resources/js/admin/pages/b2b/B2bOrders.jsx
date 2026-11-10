import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth';
import DataTable, { FilterBar, SearchInput } from '../../components/DataTable';
import { Icon, Money, Page, StatusBadge, Tabs, eur, formatDate } from '../../components/ui';
import { STAGE_OPTIONS, stageLabel } from '../../lib';
import { B2B_CRUMB, useSalesRepOptions } from './shared';

const TABS = [
    { label: 'All', status: '' },
    { label: 'Awaiting approval', status: 'awaiting_approval' },
    { label: 'Confirmed', status: 'confirmed' },
    { label: 'Cancelled', status: 'cancelled' },
];

/** Business orders (cash on delivery). Sales persons see only their businesses' orders. */
export default function B2bOrders() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { can } = useAuth();
    const reps = useSalesRepOptions(can(['b2b.view', 'b2b.manage']));
    const [f, setF] = useState({
        q: params.get('q') || '', status: params.get('status') || '', stage: '', sales_rep_id: params.get('sales_rep_id') || '',
        user_id: params.get('user_id') || '', from: '', to: '',
    });
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    const columns = [
        { key: 'order_number', label: 'Order', sortable: true, render: (o) => (
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-mono">{o.order_number}</span>
                <span className="text-xs text-secondary-foreground">{o.items_count} item{o.items_count === 1 ? '' : 's'}</span>
            </div>
        ) },
        { key: 'created_at', label: 'Date', sortable: true, render: (o) => <span className="text-sm text-secondary-foreground whitespace-nowrap">{formatDate(o.created_at)}</span> },
        { key: 'company', label: 'Business', render: (o) => (
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-mono">{o.company_name}</span>
                <span className="text-xs text-secondary-foreground">{o.customer_name}{o.tier && <> · {o.tier}</>}</span>
            </div>
        ) },
        { key: 'sales_rep', label: 'Sales person', render: (o) => <span className="text-sm">{o.sales_rep?.name || '—'}</span> },
        { key: 'status', label: 'Status', sortable: true, render: (o) => <StatusBadge value={o.status} /> },
        { key: 'stage', label: 'Stage', sortable: true, render: (o) => (o.stage ? <StatusBadge value={o.stage} label={stageLabel(o.stage)} /> : <span className="text-muted-foreground">—</span>) },
        { key: 'total_eur', label: 'Total', sortable: true, className: 'text-end', render: (o) => (
            <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm font-medium text-mono"><Money value={o.total} /></span>
                {o.currency !== 'EUR' && <span className="text-xs text-secondary-foreground">{eur(o.total_eur)}</span>}
            </div>
        ) },
        { key: 'commission', label: 'Commission', className: 'text-end', render: (o) => (o.commission ? (
            <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm text-mono"><Money value={o.commission.amount} /></span>
                <StatusBadge value={o.commission.state} />
            </div>
        ) : '—') },
    ];

    return (
        <Page title="B2B orders" crumbs={[B2B_CRUMB, { label: 'Orders' }]}>
            <div className="kt-card kt-card-grid min-w-full">
                <div className="kt-card-header py-3 flex-wrap gap-3">
                    <Tabs className="border-b-0" tabs={TABS.map((t) => ({ value: t.status, label: t.label }))} value={f.status} onChange={(v) => setF({ ...f, status: v })} />
                    <SearchInput value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Number, company or email" />
                </div>
                <div className="kt-card-header py-3 min-h-0 bg-muted/30">
                    <FilterBar>
                        <select className="kt-select kt-select-sm w-40" value={f.stage} onChange={set('stage')}>
                            <option value="">All stages</option>
                            {STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {reps.length > 0 && (
                            <select className="kt-select kt-select-sm w-48" value={f.sales_rep_id} onChange={set('sales_rep_id')}>
                                <option value="">All sales persons</option>
                                {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        )}
                        <div className="kt-input kt-input-sm w-40"><Icon name="calendar" /><input type="date" value={f.from} onChange={set('from')} title="From" /></div>
                        <div className="kt-input kt-input-sm w-40"><Icon name="calendar" /><input type="date" value={f.to} onChange={set('to')} title="To" /></div>
                    </FilterBar>
                    {f.user_id && (
                        <span className="kt-badge kt-badge-primary kt-badge-outline">
                            Business #{f.user_id}
                            <button type="button" className="ms-1" onClick={() => setF({ ...f, user_id: '' })}><Icon name="cross" className="text-xs" /></button>
                        </span>
                    )}
                </div>
                <div className="kt-card-table">
                    <DataTable url="/b2b/orders" columns={columns} filters={f} defaultSort="-id" onRowClick={(o) => navigate(`/b2b/orders/${o.order_number}`)} empty="No business orders match these filters." />
                </div>
            </div>
        </Page>
    );
}
