import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart from 'react-apexcharts';
import api, { errorMessage } from '../api';
import { useAuth } from '../auth';
import { Alert, Callout, Icon, Money, Page, Skeleton, StatCard, StatusBadge, eur, formatDate } from '../components/ui';
import { stageLabel } from '../lib';

export default function Dashboard() {
    const { user, can } = useAuth();
    const [d, setD] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.get('/dashboard').then(({ data }) => setD(data.data)).catch((e) => setError(errorMessage(e)));
    }, []);

    if (error) return <Page title="Dashboard"><Alert>{error}</Alert></Page>;
    if (!d) return <Page title="Dashboard"><DashboardSkeleton /></Page>;
    const k = d.kpis;
    const statusTotal = Object.values(d.orders_by_status).reduce((a, b) => a + b, 0);

    return (
        <Page
            title={`Welcome back, ${user.name.split(' ')[0]}`}
            crumbs={[{ label: 'Dashboard' }]}
            actions={<>
                {can('orders.view') && <a className="kt-btn kt-btn-outline" href="/api/v1/admin/orders-export?status=paid" target="_blank" rel="noreferrer"><Icon name="exit-down" /> Export paid orders</a>}
                <span className={`kt-badge ${d.stripe_mode === 'live' ? 'kt-badge-destructive' : 'kt-badge-warning'} kt-badge-outline`}><Icon name="credit-cart" /> Stripe {d.stripe_mode} mode</span>
            </>}
        >
            {d.gold.warning && <Callout type="danger" title="Gold rate API">{d.gold.warning} {d.gold.last_error?.message && <span className="block text-xs mt-1">Last error: {d.gold.last_error.message}</span>}</Callout>}
            {d.stock_issues > 0 && <Callout type="warning" title="Stock issue">{d.stock_issues} paid order(s) went below zero stock. <Link to="/orders?stock_issue=1" className="kt-link">Review</Link></Callout>}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-7.5">
                <StatCard value={eur(k.revenue_today)} label="Revenue today" icon="euro" color="primary" />
                <StatCard value={eur(k.revenue_7d)} label="Revenue, 7 days" icon="chart-line-up" color="success" />
                <StatCard value={eur(k.revenue_30d)} label="Revenue, 30 days" icon="graph-up" color="info" />
                <StatCard value={k.paid_orders_30d} label="Paid orders, 30 days" hint={`AOV ${eur(k.average_order_value_30d)}`} icon="handcart" color="warning" to={can('orders.view') ? '/orders?status=paid' : undefined} />
            </div>

            <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch">
                <div className="lg:col-span-2">
                    <div className="kt-card h-full">
                        <div className="kt-card-header">
                            <h3 className="kt-card-title">Revenue, last 30 days</h3>
                            <span className="text-sm text-secondary-foreground">EUR</span>
                        </div>
                        <div className="kt-card-content flex flex-col justify-end items-stretch grow px-3 py-1">
                            <RevenueChart rows={d.revenue_chart} />
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-1">
                    <Highlights d={d} statusTotal={statusTotal} />
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch">
                <div className="lg:col-span-2 grid gap-5 lg:gap-7.5">
                    <OrdersCard title="To craft" subtitle="Paid orders in Placed / Crafting" rows={d.to_craft} more={can('orders.view') && '/orders?to_craft=1'} empty="Nothing waiting for the workshop." />
                    <OrdersCard title="Recent orders" rows={d.recent_orders} more={can('orders.view') && '/orders'} />
                </div>
                <div className="lg:col-span-1 grid gap-5 lg:gap-7.5 content-start">
                    <GoldCard gold={d.gold} manage={can('pricing.manage')} />
                    <FxCard fx={d.fx} manage={can('pricing.manage')} />
                    <LowStock rows={d.low_stock} link={can('catalog.manage')} />
                    <div className="grid grid-cols-2 gap-5">
                        <StatCard value={k.new_customers_30d} label="New customers" hint={`${k.customers_total} total`} icon="user-tick" color="secondary" to={can('customers.view') ? '/customers' : undefined} />
                        <StatCard value={k.paid_orders_total} label="Paid orders" hint="All time" icon="receipt-square" color="dark" />
                    </div>
                </div>
            </div>
        </Page>
    );
}

function RevenueChart({ rows }) {
    const dark = document.documentElement.classList.contains('dark');
    const options = {
        chart: { type: 'area', toolbar: { show: false }, fontFamily: 'Inter, sans-serif', animations: { enabled: true, speed: 600 } },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 3, colors: ['var(--color-primary, #3b82f6)'] },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 90, 100] } },
        colors: ['#3b82f6'],
        xaxis: {
            categories: rows.map((r) => r.date.slice(5)),
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { colors: dark ? '#a1a1aa' : '#71717a', fontSize: '12px' }, rotate: 0, hideOverlappingLabels: true },
            tickAmount: 8,
        },
        yaxis: { labels: { style: { colors: dark ? '#a1a1aa' : '#71717a', fontSize: '12px' }, formatter: (v) => `€${Math.round(v).toLocaleString()}` } },
        grid: { borderColor: dark ? '#27272a' : '#f1f1f4', strokeDashArray: 5, yaxis: { lines: { show: true } } },
        tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: (v) => eur(Math.round(v * 100)) } },
        markers: { size: 0, hover: { size: 5 } },
    };
    return <Chart options={options} series={[{ name: 'Revenue', data: rows.map((r) => r.revenue_eur / 100) }]} type="area" height={280} />;
}

const STATUS_COLORS = { paid: 'bg-green-500', pending_payment: 'bg-yellow-500', payment_failed: 'bg-destructive', cancelled: 'bg-zinc-400', refunded: 'bg-zinc-800', partially_refunded: 'bg-violet-500' };

function Highlights({ d, statusTotal }) {
    const entries = Object.entries(d.orders_by_status);
    return (
        <div className="kt-card h-full">
            <div className="kt-card-header"><h3 className="kt-card-title">Highlights</h3></div>
            <div className="kt-card-content flex flex-col gap-4 p-5 lg:p-7.5 lg:pt-4">
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-normal text-secondary-foreground">Revenue, 30 days</span>
                    <div className="flex items-center gap-2.5">
                        <span className="text-3xl font-semibold text-mono">{eur(d.kpis.revenue_30d)}</span>
                        <span className="kt-badge kt-badge-outline kt-badge-success kt-badge-sm">{d.kpis.paid_orders_30d} orders</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 mb-1.5">
                    {entries.map(([s, c]) => <div key={s} className={`h-2 rounded-xs ${STATUS_COLORS[s] || 'bg-zinc-300'} transition-all`} style={{ width: `${(c / (statusTotal || 1)) * 100}%` }} />)}
                    {!entries.length && <div className="h-2 rounded-xs bg-muted w-full" />}
                </div>
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5">
                    {entries.map(([s, c]) => (
                        <div key={s} className="flex items-center gap-1.5">
                            <span className={`rounded-full size-2 ${STATUS_COLORS[s] || 'bg-zinc-300'}`} />
                            <span className="text-sm font-normal text-foreground capitalize">{s.replace(/_/g, ' ')} ({c})</span>
                        </div>
                    ))}
                </div>
                <div className="border-b border-input" />
                <div className="grid gap-3">
                    {['placed', 'crafting', 'quality_check', 'shipped', 'delivered'].map((s) => (
                        <div key={s} className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                                <Icon name={{ placed: 'basket', crafting: 'wrench', quality_check: 'shield-tick', shipped: 'delivery', delivered: 'check-circle' }[s]} className="text-base text-muted-foreground" />
                                <span className="text-sm font-normal text-mono">{stageLabel(s)}</span>
                            </div>
                            <span className="text-sm font-medium text-foreground">{d.orders_by_stage[s] || 0}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function OrdersCard({ title, subtitle, rows, more, empty = 'No orders yet.' }) {
    return (
        <div className="kt-card kt-card-grid min-w-full">
            <div className="kt-card-header">
                <div className="flex flex-col">
                    <h3 className="kt-card-title">{title}</h3>
                    {subtitle && <span className="text-sm text-secondary-foreground">{subtitle}</span>}
                </div>
                {more && <Link to={more} className="kt-btn kt-btn-sm kt-btn-outline">View all <Icon name="black-right" /></Link>}
            </div>
            <div className="kt-card-table">
                <div className="kt-scrollable-x-auto">
                    <table className="kt-table kt-table-border align-middle">
                        <thead>
                            <tr><th>Order</th><th>Customer</th><th>Status</th><th>Stage</th><th className="text-end">Total</th><th>Date</th></tr>
                        </thead>
                        <tbody>
                            {rows.map((o) => (
                                <tr key={o.order_number}>
                                    <td className="whitespace-nowrap"><Link to={`/orders/${o.order_number}`} className="text-sm font-medium text-mono hover:text-primary">{o.order_number}</Link></td>
                                    <td className="text-sm text-foreground">{o.customer}</td>
                                    <td><StatusBadge value={o.status} /></td>
                                    <td>{o.stage ? <StatusBadge value={o.stage} label={stageLabel(o.stage)} /> : <span className="text-muted-foreground">—</span>}</td>
                                    <td className="text-end text-sm font-medium text-mono"><Money value={o.total} /></td>
                                    <td className="text-sm text-secondary-foreground whitespace-nowrap">{formatDate(o.created_at)}</td>
                                </tr>
                            ))}
                            {!rows.length && <tr><td colSpan={6} className="text-center text-sm text-secondary-foreground py-8">{empty}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function GoldCard({ gold, manage }) {
    return (
        <div className="kt-card">
            <div className="kt-card-header">
                <h3 className="kt-card-title">Gold rate</h3>
                {manage && <Link to="/pricing/gold" className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" title="Manage"><Icon name="setting-2" /></Link>}
            </div>
            <div className="kt-card-content flex items-center gap-4">
                <span className="flex items-center justify-center size-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20"><Icon name="crown-2" className="text-2xl text-yellow-600" /></span>
                <div className="flex flex-col gap-1">
                    <span className="text-2xl font-semibold text-mono leading-none">{eur(gold.per_oz)}<span className="text-sm font-normal text-secondary-foreground">/oz</span></span>
                    <span className="flex items-center gap-1.5 text-xs text-secondary-foreground"><StatusBadge value={gold.source} /> {formatDate(gold.updated_at)}</span>
                </div>
            </div>
            {gold.warning && <div className="kt-card-footer text-xs text-destructive">{gold.warning}</div>}
        </div>
    );
}

function FxCard({ fx, manage }) {
    return (
        <div className="kt-card">
            <div className="kt-card-header">
                <h3 className="kt-card-title">Currencies</h3>
                <div className="flex items-center gap-2">
                    <StatusBadge value={fx.source} />
                    {fx.stale && <span className="kt-badge kt-badge-sm kt-badge-destructive">stale</span>}
                    {manage && <Link to="/pricing/currencies" className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" title="Manage"><Icon name="setting-2" /></Link>}
                </div>
            </div>
            <div className="kt-card-content grid gap-2.5">
                {fx.currencies.map((c) => (
                    <div key={c.code} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2"><span className="kt-badge kt-badge-sm kt-badge-outline w-12 justify-center">{c.code}</span><span className="text-secondary-foreground">{c.name}</span></span>
                        <span className="font-medium text-mono">{c.rate ?? '—'}</span>
                    </div>
                ))}
                {fx.last_error && <div className="text-xs text-destructive">{fx.last_error.message}</div>}
            </div>
        </div>
    );
}

function LowStock({ rows, link }) {
    return (
        <div className="kt-card">
            <div className="kt-card-header"><h3 className="kt-card-title">Low stock</h3><span className="kt-badge kt-badge-sm kt-badge-outline">{rows.length}</span></div>
            <div className="kt-card-content grid gap-3">
                {rows.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                        {link ? <Link to={`/products/${p.id}`} className="text-sm font-medium text-mono hover:text-primary">{p.name}</Link> : <span className="text-sm text-mono">{p.name}</span>}
                        <span className={`kt-badge kt-badge-sm ${p.stock_qty <= 0 ? 'kt-badge-destructive' : 'kt-badge-warning'}`}>{p.stock_qty}</span>
                    </div>
                ))}
                {!rows.length && <span className="flex items-center gap-2 text-sm text-secondary-foreground"><Icon name="check-circle" className="text-green-500" /> All products are stocked.</span>}
            </div>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-7.5">
                {[0, 1, 2, 3].map((i) => <div key={i} className="kt-card"><div className="kt-card-content flex gap-4"><Skeleton className="size-12 rounded-xl" /><div className="grow grid gap-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-3 w-1/2" /></div></div></div>)}
            </div>
            <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5">
                <div className="lg:col-span-2 kt-card"><div className="kt-card-content"><Skeleton className="h-[280px]" /></div></div>
                <div className="kt-card"><div className="kt-card-content grid gap-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-2" />{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4" />)}</div></div>
            </div>
        </>
    );
}
