import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import api, { errorMessage, fieldErrors } from '../../api';
import { Callout, Card, Page, Spinner, StatusBadge, eur, formatDate, useFlash } from '../../components/ui';
import { Input, MoneyInput } from '../../components/form';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function GoldRate() {
    const [d, setD] = useState(null);
    const [form, setForm] = useState({});
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useFlash();

    const load = () => api.get('/pricing/gold', { params: { days: 90 } }).then(({ data }) => {
        setD(data.data);
        setForm({ manual_rate_per_oz: data.data.status.manual_rate_per_oz, fetch_interval_minutes: data.data.status.fetch_interval_minutes });
    });
    useEffect(() => { load(); }, []);

    const save = async (body, msg) => {
        setBusy(true);
        try {
            const { data } = await api.put('/pricing/gold', body);
            setFlash(data.message || msg);
            load();
        } catch (e) {
            const fe = fieldErrors(e);
            setFlash(fe.source || Object.values(fe)[0] || errorMessage(e), 'danger');
        } finally {
            setBusy(false);
        }
    };

    const fetchNow = async () => {
        setBusy(true);
        try {
            const { data } = await api.post('/pricing/gold/fetch');
            setFlash(data.message);
        } catch (e) {
            setFlash(e.response?.data?.message || errorMessage(e), 'danger');
        } finally {
            setBusy(false);
            load();
        }
    };

    if (!d) return <Page title="Gold rate"><Spinner /></Page>;
    const s = d.status;
    const series = [...d.history].reverse();

    return (
        <Page title="Gold rate" crumbs={[{ label: 'Pricing' }, { label: 'Gold rate' }]}>
            {flash}
            {s.warning && <Callout type="danger" title="API warning">{s.warning}{s.last_error && <div className="small">Last error: {s.last_error.message} ({formatDate(s.last_error.at)})</div>}</Callout>}
            <div className="row">
                <div className="col-lg-4">
                    <Card title="Rate in use" outline="warning">
                        <h2>{eur(s.per_oz)}<small className="fs-6 text-secondary">/oz</small></h2>
                        <p className="mb-1">Source: <StatusBadge value={s.source} /></p>
                        <p className="small text-secondary">Updated {formatDate(s.updated_at)}</p>
                        <div className="btn-group w-100" role="group">
                            <button className={`btn ${s.source === 'manual' ? 'btn-secondary' : 'btn-outline-secondary'}`} disabled={busy || s.source === 'manual'} onClick={() => save({ source: 'manual' }, 'Switched to manual.')}>Manual</button>
                            <button className={`btn ${s.source === 'api' ? 'btn-info' : 'btn-outline-info'}`} disabled={busy || s.source === 'api' || !s.can_use_api} title={!s.can_use_api ? 'Run "Test & fetch now" successfully first' : ''} onClick={() => save({ source: 'api' }, 'Switched to API.')}>API</button>
                        </div>
                        {!s.can_use_api && <div className="small text-secondary mt-2">API can be selected after a successful "Test & fetch now". There is no automatic switching between sources.</div>}
                    </Card>
                    <Card title="Manual rate">
                        <MoneyInput label="EUR per troy ounce" value={form.manual_rate_per_oz} onChange={(v) => setForm({ ...form, manual_rate_per_oz: v })} />
                        <button className="btn btn-primary" disabled={busy} onClick={() => save({ manual_rate_per_oz: form.manual_rate_per_oz }, 'Manual rate saved.')}>Save manual rate</button>
                    </Card>
                    <Card title={`API provider: ${s.provider}`}>
                        <p className="small mb-1">API key configured: {s.api_key_configured ? <span className="badge text-bg-success">yes</span> : <span className="badge text-bg-danger">no (GOLD_API_KEY)</span>}</p>
                        <p className="small mb-1">Last good API rate: {s.last_api_rate ? <>{eur(s.last_api_rate.per_oz)} · {formatDate(s.last_api_rate.fetched_at)}</> : '—'}</p>
                        <p className="small mb-2">Consecutive failures: {s.consecutive_failures}</p>
                        <Input label="Fetch interval (minutes)" type="number" value={form.fetch_interval_minutes} onChange={(v) => setForm({ ...form, fetch_interval_minutes: v })} help="Mind the provider's monthly request quota. Fetches only run while the source is API." />
                        <div className="d-flex gap-2">
                            <button className="btn btn-outline-primary" disabled={busy} onClick={() => save({ fetch_interval_minutes: form.fetch_interval_minutes }, 'Interval saved.')}>Save interval</button>
                            <button className="btn btn-warning" disabled={busy} onClick={fetchNow}><i className="bi bi-cloud-download" /> Test & fetch now</button>
                        </div>
                    </Card>
                </div>
                <div className="col-lg-8">
                    <Card title="History (90 days)">
                        {series.length > 1 ? (
                            <Line height={110} data={{
                                labels: series.map((h) => h.fetched_at.slice(0, 16).replace('T', ' ')),
                                datasets: [
                                    { label: 'API', data: series.map((h) => (h.source === 'api' ? h.rate_per_oz / 100 : null)), borderColor: '#0dcaf0', spanGaps: true },
                                    { label: 'Manual', data: series.map((h) => (h.source === 'manual' ? h.rate_per_oz / 100 : null)), borderColor: '#6c757d', spanGaps: true },
                                ],
                            }} />
                        ) : <p className="text-secondary">Not enough data for a chart yet.</p>}
                    </Card>
                    <Card noBody title="Entries">
                        <div className="table-responsive" style={{ maxHeight: 420 }}>
                            <table className="table table-sm table-striped mb-0">
                                <thead><tr><th>When</th><th>Source</th><th>Provider</th><th className="text-end">Rate/oz</th></tr></thead>
                                <tbody>{d.history.map((h) => <tr key={h.id}><td>{formatDate(h.fetched_at)}</td><td><StatusBadge value={h.source} /></td><td>{h.provider || '—'}</td><td className="text-end">{eur(h.rate_per_oz)}</td></tr>)}</tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>
        </Page>
    );
}
