import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import api, { errorMessage } from '../api';
import { useAuth } from '../auth';
import { Alert, Callout, Card, Money, Page, SmallBox, Spinner, StatusBadge, eur, formatDate } from '../components/ui';
import { stageLabel } from '../lib';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function Dashboard() {
    const { can } = useAuth();
    const [d, setD] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.get('/dashboard').then(({ data }) => setD(data.data)).catch((e) => setError(errorMessage(e)));
    }, []);

    if (error) return <Page title="Dashboard"><Alert>{error}</Alert></Page>;
    if (!d) return <Page title="Dashboard"><Spinner /></Page>;
    const k = d.kpis;

    return (
        <Page title="Dashboard">
            {d.stripe_mode === 'test' && <Callout type="warning">Stripe is in <strong>test mode</strong>.</Callout>}
            {d.gold.warning && <Callout type="danger" title="Gold rate">{d.gold.warning} {d.gold.last_error?.message && <small className="d-block">Last error: {d.gold.last_error.message}</small>}</Callout>}
            {d.stock_issues > 0 && <Callout type="danger">{d.stock_issues} paid order(s) have a stock issue. <Link to="/orders?stock_issue=1">Review</Link></Callout>}

            <div className="row">
                <div className="col-lg-3 col-6"><SmallBox value={eur(k.revenue_today)} label="Revenue today" icon="bi-currency-euro" color="primary" /></div>
                <div className="col-lg-3 col-6"><SmallBox value={eur(k.revenue_7d)} label="Revenue 7 days" icon="bi-graph-up" color="success" /></div>
                <div className="col-lg-3 col-6"><SmallBox value={eur(k.revenue_30d)} label="Revenue 30 days" icon="bi-bar-chart" color="info" /></div>
                <div className="col-lg-3 col-6"><SmallBox value={k.paid_orders_30d} label={`Paid orders (30d) · AOV ${eur(k.average_order_value_30d)}`} icon="bi-bag-check" color="warning" to="/orders?status=paid" /></div>
                <div className="col-lg-3 col-6"><SmallBox value={k.new_customers_30d} label={`New customers (30d) · ${k.customers_total} total`} icon="bi-person-plus" color="secondary" to="/customers" /></div>
                <div className="col-lg-3 col-6"><SmallBox value={k.paid_orders_total} label="Paid orders (all time)" icon="bi-receipt" color="dark" /></div>
            </div>

            <div className="row">
                <div className="col-lg-8">
                    <Card title="Revenue, last 30 days (EUR)">
                        <Bar
                            height={110}
                            data={{
                                labels: d.revenue_chart.map((r) => r.date.slice(5)),
                                datasets: [{ label: 'Revenue €', data: d.revenue_chart.map((r) => r.revenue_eur / 100), backgroundColor: 'rgba(168,134,42,.7)' }],
                            }}
                            options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
                        />
                    </Card>
                    <Card title="To craft (paid, placed/crafting)" noBody tools={<Link to="/orders?to_craft=1" className="btn btn-sm btn-outline-primary">All</Link>}>
                        <OrdersTable rows={d.to_craft} empty="Nothing waiting for the workshop." />
                    </Card>
                    <Card title="Recent orders" noBody>
                        <OrdersTable rows={d.recent_orders} />
                    </Card>
                </div>
                <div className="col-lg-4">
                    <Card title="Gold rate" outline={d.gold.warning ? 'danger' : 'warning'} tools={can('pricing.manage') && <Link to="/pricing/gold" className="btn btn-sm btn-outline-secondary">Manage</Link>}>
                        <h3 className="mb-1">{eur(d.gold.per_oz)}<small className="fs-6 text-secondary">/oz</small></h3>
                        <div>Source: <StatusBadge value={d.gold.source} /></div>
                        <div className="small text-secondary">Updated {formatDate(d.gold.updated_at)}</div>
                        {d.gold.source === 'api' && d.gold.api_age_minutes !== null && <div className="small">API rate age: {Math.round(d.gold.api_age_minutes / 6) / 10} h</div>}
                    </Card>
                    <Card title="Currencies" tools={can('pricing.manage') && <Link to="/pricing/currencies" className="btn btn-sm btn-outline-secondary">Manage</Link>}>
                        <div className="mb-2">FX source: <StatusBadge value={d.fx.source} /> {d.fx.stale && <span className="badge text-bg-danger">stale</span>}</div>
                        <table className="table table-sm mb-0">
                            <tbody>{d.fx.currencies.map((c) => <tr key={c.code}><td>{c.code}</td><td className="text-end">{c.rate ?? '—'}</td></tr>)}</tbody>
                        </table>
                        {d.fx.last_error && <div className="small text-danger mt-2">{d.fx.last_error.message}</div>}
                    </Card>
                    <Card title="Orders by status">
                        {Object.entries(d.orders_by_status).map(([s, c]) => <div key={s} className="d-flex justify-content-between"><StatusBadge value={s} /><strong>{c}</strong></div>)}
                        {!Object.keys(d.orders_by_status).length && <span className="text-secondary">No orders yet.</span>}
                        <hr />
                        {Object.entries(d.orders_by_stage).map(([s, c]) => <div key={s} className="d-flex justify-content-between"><span>{stageLabel(s)}</span><strong>{c}</strong></div>)}
                    </Card>
                    <Card title="Low stock" noBody>
                        <ul className="list-group list-group-flush">
                            {d.low_stock.map((p) => (
                                <li key={p.id} className="list-group-item d-flex justify-content-between">
                                    {can('catalog.manage') ? <Link to={`/products/${p.id}`}>{p.name}</Link> : p.name}
                                    <span className={`badge ${p.stock_qty <= 0 ? 'text-bg-danger' : 'text-bg-warning'}`}>{p.stock_qty}</span>
                                </li>
                            ))}
                            {!d.low_stock.length && <li className="list-group-item text-secondary">All good.</li>}
                        </ul>
                    </Card>
                </div>
            </div>
        </Page>
    );
}

function OrdersTable({ rows, empty = 'No orders yet.' }) {
    return (
        <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
                <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Stage</th><th className="text-end">Total</th><th>Date</th></tr></thead>
                <tbody>
                    {rows.map((o) => (
                        <tr key={o.order_number}>
                            <td><Link to={`/orders/${o.order_number}`}>{o.order_number}</Link></td>
                            <td>{o.customer}</td>
                            <td><StatusBadge value={o.status} /></td>
                            <td>{o.stage ? <StatusBadge value={o.stage} label={stageLabel(o.stage)} /> : '—'}</td>
                            <td className="text-end"><Money value={o.total} /></td>
                            <td className="small">{formatDate(o.created_at)}</td>
                        </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={6} className="text-secondary text-center py-3">{empty}</td></tr>}
                </tbody>
            </table>
        </div>
    );
}
