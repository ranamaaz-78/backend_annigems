import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../../api';
import { useAuth } from '../../auth';
import { Alert, Callout, Card, Icon, Money, Page, Skeleton, StatCard, StatusBadge, formatDate } from '../../components/ui';
import { stageLabel } from '../../lib';
import { B2B_CRUMB, ByBusinessTable, PeriodFilter, SalesChart, defaultPeriod, useSalesRepOptions } from './shared';

/**
 * Commission (EUR). Pending = order placed, not delivered; earned = delivered; void = cancelled.
 * To pay = earned − paid out. Sales persons see their own; staff can pick one sales person.
 */
export default function Commissions() {
    const { can } = useAuth();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const reps = useSalesRepOptions(can(['b2b.view', 'b2b.manage']));
    const [period, setPeriod] = useState(defaultPeriod('week'));
    const rep = params.get('sales_rep_id') || '';
    const [d, setD] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.get('/b2b/commissions', { params: { ...period, sales_rep_id: rep || undefined } })
            .then(({ data }) => setD(data.data)).catch((e) => setError(errorMessage(e)));
    }, [period, rep]);

    const crumbs = [B2B_CRUMB, { label: 'Commissions' }];
    if (error) return <Page title="Commissions" crumbs={crumbs}><Alert>{error}</Alert></Page>;
    if (!d) return <Page title="Commissions" crumbs={crumbs}><Skeleton className="h-24" /><Skeleton className="h-72" /></Page>;
    const s = d.summary;
    const p = d.period;
    const repName = rep && reps.find((r) => String(r.id) === rep)?.name;

    return (
        <Page
            title={d.scoped ? 'My commission' : repName ? `Commission · ${repName}` : 'Commissions'}
            crumbs={crumbs}
            actions={<>
                {!d.scoped && reps.length > 0 && (
                    <select className="kt-select w-56" value={rep} onChange={(e) => setParams(e.target.value ? { sales_rep_id: e.target.value } : {})}>
                        <option value="">All sales persons</option>
                        {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                )}
                {can('b2b.payouts') && <Link className="kt-btn kt-btn-outline" to={`/b2b/payouts${rep ? `?sales_rep_id=${rep}` : ''}`}>Payouts</Link>}
                {can('b2b.payouts') && rep && s.balance.amount > 0 && <Link className="kt-btn kt-btn-primary" to={`/b2b/payouts?sales_rep_id=${rep}&new=1`}><Icon name="wallet" /> Pay {s.balance.formatted}</Link>}
            </>}
        >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-7.5">
                <StatCard value={<Money value={s.pending} />} label="Pending" hint="Placed, not delivered yet" icon="timer" color="warning" />
                <StatCard value={<Money value={s.earned} />} label="Earned" hint="Delivered orders" icon="check-circle" color="success" />
                <StatCard value={<Money value={s.paid} />} label="Paid out" icon="wallet" color="info" to={can(['b2b.payouts', 'b2b.sales', 'b2b.view']) ? '/b2b/payouts' : undefined} />
                <StatCard value={<Money value={s.balance} />} label="To pay" hint="Earned − paid out" icon="dollar" color="primary" />
            </div>
            <Callout type="info">
                Commission = sales person % × products total after the tier discount (shipping and tax are not included).
                It is pending until the order is delivered and void if the order is cancelled. All amounts in EUR.
            </Callout>

            <Card title="Orders, sales and commission" description={`${p.totals.orders} orders · ${p.totals.sales.formatted} sales · ${p.totals.commission.formatted} commission${p.totals.cancelled ? ` · ${p.totals.cancelled} cancelled` : ''}`} tools={<PeriodFilter value={period} onChange={setPeriod} />}>
                <SalesChart series={p.series} />
                <div className="kt-scrollable-x-auto mt-4">
                    <table className="kt-table kt-table-border align-middle">
                        <thead><tr><th>{period.group === 'day' ? 'Day' : period.group === 'week' ? 'Week of' : 'Month'}</th><th className="text-end">Orders</th><th className="text-end">Sales</th><th className="text-end">Commission</th></tr></thead>
                        <tbody>
                            {p.series.filter((r) => r.orders > 0).reverse().map((r) => (
                                <tr key={r.period}>
                                    <td className="text-sm text-mono">{r.period}</td>
                                    <td className="text-end text-sm">{r.orders}</td>
                                    <td className="text-end text-sm">{eurText(r.sales_eur)}</td>
                                    <td className="text-end text-sm font-medium">{eurText(r.commission_eur)}</td>
                                </tr>
                            ))}
                            {!p.series.some((r) => r.orders > 0) && <tr><td colSpan={4} className="text-sm text-secondary-foreground text-center py-5">No orders in this period.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="grid lg:grid-cols-2 gap-5 lg:gap-7.5 items-start">
                <Card title="By business" description="In this period" noBody>
                    <ByBusinessTable rows={p.by_business} onOpen={(r) => navigate(`/b2b/businesses/${r.user_id}`)} />
                </Card>
                {!d.scoped && (
                    <Card title="By sales person" description="All time" noBody>
                        <div className="kt-scrollable-x-auto">
                            <table className="kt-table kt-table-border align-middle">
                                <thead><tr><th>Sales person</th><th className="text-end">Rate</th><th className="text-end">Pending</th><th className="text-end">Earned</th><th className="text-end">Paid</th><th className="text-end">To pay</th>{can('b2b.payouts') && <th />}</tr></thead>
                                <tbody>
                                    {d.by_rep.map((r) => (
                                        <tr key={r.sales_rep_id} className="row-link" onClick={() => setParams({ sales_rep_id: r.sales_rep_id })}>
                                            <td className="text-sm font-medium text-mono">{r.name}</td>
                                            <td className="text-end text-sm">{r.commission_rate}%</td>
                                            <td className="text-end text-sm"><Money value={r.pending} /></td>
                                            <td className="text-end text-sm"><Money value={r.earned} /></td>
                                            <td className="text-end text-sm"><Money value={r.paid} /></td>
                                            <td className="text-end text-sm font-semibold"><Money value={r.balance} /></td>
                                            {can('b2b.payouts') && (
                                                <td className="text-end" onClick={(e) => e.stopPropagation()}>
                                                    {r.balance.amount > 0 && <Link className="kt-btn kt-btn-sm kt-btn-outline" to={`/b2b/payouts?sales_rep_id=${r.sales_rep_id}&new=1`}>Pay</Link>}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {!d.by_rep.length && <tr><td colSpan={6} className="text-sm text-secondary-foreground text-center py-5">No commission yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>

            <Card title="Orders in this period" description="Latest 100" noBody>
                <div className="kt-scrollable-x-auto">
                    <table className="kt-table kt-table-border align-middle">
                        <thead><tr><th>Order</th><th>Business</th>{!d.scoped && <th>Sales person</th>}<th>Status</th><th className="text-end">Total</th><th className="text-end">Commission</th></tr></thead>
                        <tbody>
                            {p.orders.map((o) => (
                                <tr key={o.order_number} className="row-link" onClick={() => navigate(`/b2b/orders/${o.order_number}`)}>
                                    <td><div className="flex flex-col"><span className="text-sm font-medium text-mono">{o.order_number}</span><span className="text-xs text-secondary-foreground">{formatDate(o.created_at)}</span></div></td>
                                    <td className="text-sm">{o.company_name}</td>
                                    {!d.scoped && <td className="text-sm">{o.sales_rep || '—'}</td>}
                                    <td><div className="flex flex-wrap gap-1"><StatusBadge value={o.status} />{o.stage && <StatusBadge value={o.stage} label={stageLabel(o.stage)} />}</div></td>
                                    <td className="text-end text-sm"><Money value={o.total_eur} /></td>
                                    <td className="text-end text-sm">{o.commission_eur ? <span className="flex flex-col items-end gap-0.5"><Money value={o.commission_eur} /><StatusBadge value={o.commission_state} /></span> : '—'}</td>
                                </tr>
                            ))}
                            {!p.orders.length && <tr><td colSpan={6} className="text-sm text-secondary-foreground text-center py-5">No orders in this period.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Card>
        </Page>
    );
}

const eurText = (minor) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(minor / 100);
