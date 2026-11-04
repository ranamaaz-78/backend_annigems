import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { download } from '../../api';
import DataTable, { FilterBar } from '../../components/DataTable';
import { Card, Money, Page, StatusBadge, eur, formatDate } from '../../components/ui';
import { STAGE_OPTIONS, STATUS_OPTIONS, stageLabel } from '../../lib';

export default function OrdersList() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [f, setF] = useState({
        q: '', status: params.get('status') || '', stage: '', currency: '', platform: '', from: '', to: '',
        to_craft: params.get('to_craft') || '', stock_issue: params.get('stock_issue') || '', user_id: params.get('user_id') || '',
    });
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    const columns = [
        { key: 'order_number', label: 'Order', sortable: true, render: (o) => <strong>{o.order_number}</strong> },
        { key: 'created_at', label: 'Date', sortable: true, render: (o) => <span className="small">{formatDate(o.created_at)}</span> },
        { key: 'customer', label: 'Customer', render: (o) => <>{o.customer_name}<div className="small text-secondary">{o.email}</div></> },
        { key: 'status', label: 'Status', sortable: true, render: (o) => <StatusBadge value={o.status} /> },
        { key: 'stage', label: 'Stage', sortable: true, render: (o) => (o.stage ? <StatusBadge value={o.stage} label={stageLabel(o.stage)} /> : '—') },
        { key: 'placed_from', label: 'Platform', render: (o) => <span className="badge text-bg-light border">{o.placed_from}</span> },
        { key: 'items_count', label: 'Items', className: 'text-center' },
        { key: 'total_eur', label: 'Total', sortable: true, className: 'text-end', render: (o) => <><Money value={o.total} />{o.currency !== 'EUR' && <div className="small text-secondary">{eur(o.total_eur)}</div>}</> },
        { key: 'flags', label: '', render: (o) => o.stock_issue && <span className="badge text-bg-danger" title="Stock issue">stock</span> },
    ];

    return (
        <Page title="Orders" crumbs={[{ label: 'Orders' }]}>
            <Card noBody>
                <div className="p-3 border-bottom">
                    <FilterBar>
                        <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Number, email or name" value={f.q} onChange={set('q')} /></div>
                        <div className="col-md-2">
                            <select className="form-select form-select-sm" value={f.status} onChange={set('status')}>
                                <option value="">All statuses</option>
                                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select className="form-select form-select-sm" value={f.stage} onChange={set('stage')}>
                                <option value="">All stages</option>
                                {STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="col-md-1">
                            <select className="form-select form-select-sm" value={f.currency} onChange={set('currency')}>
                                <option value="">Currency</option>
                                {['EUR', 'USD', 'INR', 'AED', 'GBP'].map((c) => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="col-md-1">
                            <select className="form-select form-select-sm" value={f.platform} onChange={set('platform')}>
                                <option value="">Platform</option>
                                <option value="web">Web</option>
                                <option value="mobile">Mobile</option>
                            </select>
                        </div>
                        <div className="col-md-auto"><input type="date" className="form-control form-control-sm" value={f.from} onChange={set('from')} title="From" /></div>
                        <div className="col-md-auto"><input type="date" className="form-control form-control-sm" value={f.to} onChange={set('to')} title="To" /></div>
                        <div className="col-md-auto">
                            <button className="btn btn-sm btn-outline-success" onClick={() => download('/orders-export', f, 'orders.csv')}><i className="bi bi-filetype-csv" /> Export CSV</button>
                        </div>
                    </FilterBar>
                    {(f.to_craft || f.stock_issue || f.user_id) && (
                        <div className="small">
                            Quick filter active: {f.to_craft && 'to craft '}{f.stock_issue && 'stock issues '}{f.user_id && `customer #${f.user_id} `}
                            <button className="btn btn-link btn-sm" onClick={() => setF({ ...f, to_craft: '', stock_issue: '', user_id: '' })}>clear</button>
                        </div>
                    )}
                </div>
                <DataTable url="/orders" columns={columns} filters={f} defaultSort="-id" onRowClick={(o) => navigate(`/orders/${o.order_number}`)} />
            </Card>
        </Page>
    );
}
