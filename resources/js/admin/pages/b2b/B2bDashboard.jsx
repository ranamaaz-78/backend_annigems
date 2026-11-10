import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../../api';
import { useAuth } from '../../auth';
import { Alert, Callout, Card, Icon, Money, Page, Skeleton, StatCard, StatusBadge, formatDate } from '../../components/ui';
import { stageLabel } from '../../lib';
import { ByBusinessTable, PeriodFilter, SalesChart, defaultPeriod } from './shared';

/** B2B home: KPIs, commission balance, sales per day/week/month, top businesses and sales persons. */
export default function B2bDashboard() {
    const { user, can } = useAuth();
    const navigate = useNavigate();
    const [period, setPeriod] = useState(defaultPeriod('day'));
    const [d, setD] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.get('/b2b/dashboard', { params: period }).then(({ data }) => setD(data.data)).catch((e) => setError(errorMessage(e)));
    }, [period]);

    if (error) return <Page title="B2B dashboard"><Alert>{error}</Alert></Page>;
    if (!d) {
        return (
            <Page title="B2B dashboard">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-7.5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
                <Skeleton className="h-72" />
            </Page>
        );
    }
    const k = d.kpis;
    const c = d.commission;
    const p = d.period;
    const canOnboard = can(['b2b.sales', 'b2b.manage']);

    return (
        <Page
            title={d.scoped ? `Welcome back, ${user.name.split(' ')[0]}` : 'B2B dashboard'}
            crumbs={[{ label: 'B2B' }]}
            actions={canOnboard && <Link to="/b2b/businesses?new=1" className="kt-btn kt-btn-primary"><Icon name="plus" /> Onboard business</Link>}
        >
            {k.awaiting_approval > 0 && (
                <Callout type="warning" title="Orders waiting for approval">
                    {k.awaiting_approval} business order{k.awaiting_approval === 1 ? '' : 's'} waiting. <Link to="/b2b/orders?status=awaiting_approval" className="kt-link">Review</Link>
                </Callout>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-7.5">
                <StatCard value={k.businesses} label={d.scoped ? 'My businesses' : 'Businesses'} hint={`${k.active_businesses} active`} icon="shop" color="primary" to="/b2b/businesses" />
                <StatCard value={k.awaiting_approval} label="Awaiting approval" hint={`${k.in_progress} in progress`} icon="time" color="warning" to="/b2b/orders?status=awaiting_approval" />
                <StatCard value={<Money value={c.pending} />} label="Commission pending" hint="Not delivered yet" icon="timer" color="info" to="/b2b/commissions" />
                <StatCard value={<Money value={c.balance} />} label="Commission to pay" hint={`Earned ${c.earned.formatted} · paid ${c.paid.formatted}`} icon="wallet" color="success" to="/b2b/commissions" />
            </div>

            <Card title="Sales and commission" description={`${p.totals.orders} orders · ${p.totals.sales.formatted} sales · ${p.totals.commission.formatted} commission`} tools={<PeriodFilter value={period} onChange={setPeriod} />}>
                <SalesChart series={p.series} />
            </Card>

            <div className="grid lg:grid-cols-2 gap-5 lg:gap-7.5 items-start">
                <Card title="By business" description="Orders placed in this period (cancelled left out)" noBody>
                    <ByBusinessTable rows={p.by_business.slice(0, 10)} onOpen={(r) => navigate(`/b2b/businesses/${r.user_id}`)} />
                </Card>
                {!d.scoped ? (
                    <Card title="By sales person" noBody>
                        {p.by_rep.length ? (
                            <table className="kt-table kt-table-border align-middle">
                                <thead><tr><th>Sales person</th><th className="text-end">Orders</th><th className="text-end">Sales</th><th className="text-end">Commission</th></tr></thead>
                                <tbody>
                                    {p.by_rep.map((r) => (
                                        <tr key={r.sales_rep_id} className="row-link" onClick={() => navigate(`/b2b/commissions?sales_rep_id=${r.sales_rep_id}`)}>
                                            <td className="text-sm font-medium text-mono">{r.name}</td>
                                            <td className="text-end text-sm">{r.orders}</td>
                                            <td className="text-end text-sm"><Money value={r.sales} /></td>
                                            <td className="text-end text-sm"><Money value={r.commission} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : <div className="text-sm text-secondary-foreground p-5">No orders in this period.</div>}
                    </Card>
                ) : (
                    <RecentOrders rows={p.orders.slice(0, 8)} />
                )}
            </div>
            {!d.scoped && <RecentOrders rows={p.orders.slice(0, 8)} />}
        </Page>
    );
}

function RecentOrders({ rows }) {
    const navigate = useNavigate();
    return (
        <Card title="Latest orders" tools={<Link to="/b2b/orders" className="kt-link text-sm">All B2B orders</Link>} noBody>
            {rows.length ? (
                <table className="kt-table kt-table-border align-middle">
                    <thead><tr><th>Order</th><th>Business</th><th>Status</th><th className="text-end">Total</th><th className="text-end">Commission</th></tr></thead>
                    <tbody>
                        {rows.map((o) => (
                            <tr key={o.order_number} className="row-link" onClick={() => navigate(`/b2b/orders/${o.order_number}`)}>
                                <td><div className="flex flex-col"><span className="text-sm font-medium text-mono">{o.order_number}</span><span className="text-xs text-secondary-foreground">{formatDate(o.created_at)}</span></div></td>
                                <td className="text-sm">{o.company_name}</td>
                                <td><div className="flex flex-wrap gap-1"><StatusBadge value={o.status} />{o.stage && <StatusBadge value={o.stage} label={stageLabel(o.stage)} />}</div></td>
                                <td className="text-end text-sm"><Money value={o.total_eur} /></td>
                                <td className="text-end text-sm">{o.commission_eur ? <span className="flex flex-col items-end"><Money value={o.commission_eur} /><StatusBadge value={o.commission_state} /></span> : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : <div className="text-sm text-secondary-foreground p-5">No B2B orders in this period.</div>}
        </Card>
    );
}
