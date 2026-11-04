import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { download } from '../../api';
import DataTable, { FilterBar, SearchInput } from '../../components/DataTable';
import { Icon, Money, Page, StatusBadge, Tabs, eur, formatDate } from '../../components/ui';
import { STAGE_OPTIONS, STATUS_OPTIONS, stageLabel } from '../../lib';

const TABS = [
    { label: 'All', status: '' },
    { label: 'Paid', status: 'paid' },
    { label: 'Pending payment', status: 'pending_payment' },
    { label: 'Failed', status: 'payment_failed' },
    { label: 'Cancelled', status: 'cancelled' },
    { label: 'Refunded', status: 'refunded' },
];

export default function OrdersList() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [f, setF] = useState({
        q: params.get('q') || '', status: params.get('status') || '', stage: '', currency: '', platform: '', from: '', to: '',
        to_craft: params.get('to_craft') || '', stock_issue: params.get('stock_issue') || '', user_id: params.get('user_id') || '',
    });
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
    const quick = f.to_craft || f.stock_issue || f.user_id;

    const columns = [
        { key: 'order_number', label: 'Order', sortable: true, className: 'whitespace-nowrap', render: (o) => (
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-mono">{o.order_number}</span>
                <span className="text-xs text-secondary-foreground">{o.items_count} item{o.items_count === 1 ? '' : 's'}</span>
            </div>
        ) },
        { key: 'created_at', label: 'Date', sortable: true, render: (o) => <span className="text-sm text-secondary-foreground whitespace-nowrap">{formatDate(o.created_at)}</span> },
        { key: 'customer', label: 'Customer', render: (o) => (
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-mono">{o.customer_name}</span>
                <span className="text-xs text-secondary-foreground">{o.email}</span>
            </div>
        ) },
        { key: 'status', label: 'Status', sortable: true, render: (o) => <StatusBadge value={o.status} /> },
        { key: 'stage', label: 'Stage', sortable: true, render: (o) => (o.stage ? <StatusBadge value={o.stage} label={stageLabel(o.stage)} /> : <span className="text-muted-foreground">—</span>) },
        { key: 'placed_from', label: 'Platform', render: (o) => <span className="kt-badge kt-badge-sm kt-badge-outline"><Icon name={o.placed_from === 'mobile' ? 'tablet' : 'screen'} /> {o.placed_from}</span> },
        { key: 'total_eur', label: 'Total', sortable: true, className: 'text-end', render: (o) => (
            <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm font-medium text-mono"><Money value={o.total} /></span>
                {o.currency !== 'EUR' && <span className="text-xs text-secondary-foreground">{eur(o.total_eur)}</span>}
            </div>
        ) },
        { key: 'flags', label: '', render: (o) => o.stock_issue && <span className="kt-badge kt-badge-sm kt-badge-destructive" title="Stock issue">stock</span> },
    ];

    return (
        <Page
            title="Orders"
            crumbs={[{ label: 'Orders' }]}
            actions={<button className="kt-btn kt-btn-outline" onClick={() => download('/orders-export', f, 'orders.csv')}><Icon name="exit-down" /> Export CSV</button>}
        >
            <div className="kt-card kt-card-grid min-w-full">
                <div className="kt-card-header py-3 flex-wrap gap-3">
                    <Tabs className="border-b-0" tabs={TABS.map((t) => ({ value: t.status, label: t.label }))} value={f.status} onChange={(v) => setF({ ...f, status: v })} />
                    <SearchInput value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Number, email or name" />
                </div>
                <div className="kt-card-header py-3 min-h-0 bg-muted/30">
                    <FilterBar>
                        <select className="kt-select kt-select-sm w-40" value={f.status} onChange={set('status')}>
                            <option value="">All statuses</option>
                            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select className="kt-select kt-select-sm w-40" value={f.stage} onChange={set('stage')}>
                            <option value="">All stages</option>
                            {STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select className="kt-select kt-select-sm w-32" value={f.currency} onChange={set('currency')}>
                            <option value="">Currency</option>
                            {['EUR', 'USD', 'INR', 'AED', 'GBP'].map((c) => <option key={c}>{c}</option>)}
                        </select>
                        <select className="kt-select kt-select-sm w-32" value={f.platform} onChange={set('platform')}>
                            <option value="">Platform</option>
                            <option value="web">Web</option>
                            <option value="mobile">Mobile</option>
                        </select>
                        <div className="kt-input kt-input-sm w-40"><Icon name="calendar" /><input type="date" value={f.from} onChange={set('from')} title="From" /></div>
                        <div className="kt-input kt-input-sm w-40"><Icon name="calendar" /><input type="date" value={f.to} onChange={set('to')} title="To" /></div>
                    </FilterBar>
                    {quick && (
                        <span className="kt-badge kt-badge-primary kt-badge-outline">
                            {f.to_craft && 'To craft '}{f.stock_issue && 'Stock issues '}{f.user_id && `Customer #${f.user_id}`}
                            <button type="button" className="ms-1" onClick={() => setF({ ...f, to_craft: '', stock_issue: '', user_id: '' })}><Icon name="cross" className="text-xs" /></button>
                        </span>
                    )}
                </div>
                <div className="kt-card-table">
                    <DataTable url="/orders" columns={columns} filters={f} defaultSort="-id" onRowClick={(o) => navigate(`/orders/${o.order_number}`)} empty="No orders match these filters." />
                </div>
            </div>
        </Page>
    );
}
