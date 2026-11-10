import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../../api';
import { ActiveBadge } from '../../components/CrudPage';
import DataTable from '../../components/DataTable';
import { Alert, Card, Icon, Money, Page, Row, Skeleton, StatCard, StatusBadge, formatDate } from '../../components/ui';
import { stageLabel } from '../../lib';
import { B2B_CRUMB, PeriodFilter, SalesChart, defaultPeriod } from './shared';

/** One business: profile, sales/commission per period and all its orders. */
export default function BusinessDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [period, setPeriod] = useState(defaultPeriod('month'));
    const [b, setB] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.get(`/b2b/businesses/${id}`, { params: period }).then(({ data }) => setB(data.data)).catch((e) => setError(errorMessage(e)));
    }, [id, period]);

    const crumbs = [B2B_CRUMB, { label: 'Businesses', to: '/b2b/businesses' }];
    if (error) return <Page title="Business" crumbs={crumbs}><Alert>{error}</Alert></Page>;
    if (!b) return <Page title="Business" crumbs={crumbs}><Skeleton className="h-24" /><Skeleton className="h-72" /></Page>;
    const p = b.period;

    return (
        <Page
            title={<span className="flex items-center gap-2.5">{b.company_name} <ActiveBadge active={b.is_active} /></span>}
            crumbs={[...crumbs, { label: b.company_name }]}
            actions={<Link to="/b2b/businesses" className="kt-btn kt-btn-outline"><Icon name="arrow-left" /> All businesses</Link>}
        >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-7.5">
                <StatCard value={b.orders_count} label="Orders (all time)" icon="handcart" color="primary" />
                <StatCard value={<Money value={b.sales} />} label="Sales (all time)" icon="euro" color="success" />
                <StatCard value={<Money value={b.commission} />} label="Commission (all time)" icon="percentage" color="info" />
                <StatCard value={b.last_order_at ? formatDate(b.last_order_at, false) : '—'} label="Last order" icon="calendar" color="warning" />
            </div>

            <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-start">
                <div className="lg:col-span-2">
                    <Card title="Purchases" description={`${p.totals.orders} orders · ${p.totals.sales.formatted} · commission ${p.totals.commission.formatted}`} tools={<PeriodFilter value={period} onChange={setPeriod} />}>
                        <SalesChart series={p.series} height={260} />
                    </Card>
                </div>
                <Card title="Profile">
                    <Row label="Tier">{b.tier ? <span className="kt-badge kt-badge-sm kt-badge-warning kt-badge-outline"><Icon name="crown-2" /> {b.tier.name}</span> : '—'}</Row>
                    <Row label="Sales person">{b.sales_rep?.name || '—'}</Row>
                    <Row label="Contact">{b.contact_name}</Row>
                    <Row label="Email">{b.email}</Row>
                    <Row label="Phone">{b.phone || '—'}</Row>
                    <Row label="Type">{b.business_type || '—'}</Row>
                    <Row label="Tax ID">{b.tax_id || '—'}</Row>
                    <Row label="Onboarded">{formatDate(b.created_at, false)}</Row>
                    {b.addresses.map((a) => (
                        <div key={a.id} className="text-sm text-foreground mt-3 rounded-md bg-muted/50 px-3 py-2">
                            <span className="text-xs text-secondary-foreground">{a.label || 'Address'}{a.is_default && ' · default'}</span><br />
                            {a.line1}, {a.city}{a.state && `, ${a.state}`} {a.zip}, {a.country_code}
                        </div>
                    ))}
                    {b.notes && <div className="text-sm mt-3 whitespace-pre-wrap">{b.notes}</div>}
                </Card>
            </div>

            <Card title="Orders" noBody>
                <DataTable
                    url="/b2b/orders"
                    filters={{ user_id: b.id }}
                    defaultSort="-id"
                    onRowClick={(o) => navigate(`/b2b/orders/${o.order_number}`)}
                    empty="No orders yet."
                    columns={[
                        { key: 'order_number', label: 'Order', render: (o) => <span className="text-sm font-medium text-mono">{o.order_number}</span> },
                        { key: 'created_at', label: 'Date', render: (o) => <span className="text-sm text-secondary-foreground">{formatDate(o.created_at)}</span> },
                        { key: 'status', label: 'Status', render: (o) => <div className="flex flex-wrap gap-1"><StatusBadge value={o.status} />{o.stage && <StatusBadge value={o.stage} label={stageLabel(o.stage)} />}</div> },
                        { key: 'items_count', label: 'Items', className: 'text-end', render: (o) => o.items_count },
                        { key: 'total', label: 'Total', className: 'text-end', render: (o) => <Money value={o.total} /> },
                        { key: 'commission', label: 'Commission', className: 'text-end', render: (o) => (o.commission ? <Money value={o.commission.amount} /> : '—') },
                    ]}
                />
            </Card>
        </Page>
    );
}
