import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { Callout, Card, Page, Spinner, StatusBadge, formatDate, useFlash } from '../../components/ui';

export default function Currencies() {
    const [d, setD] = useState(null);
    const [rates, setRates] = useState({});
    const [interval, setInterval_] = useState('');
    const [flash, setFlash] = useFlash();

    const apply = (data) => {
        setD(data.data);
        setRates(Object.fromEntries(data.data.currencies.map((c) => [c.code, c.manual_rate ?? ''])));
        setInterval_(data.data.status.fetch_interval_minutes);
    };
    const load = () => api.get('/pricing/currencies').then(({ data }) => apply(data));
    useEffect(() => { load(); }, []);

    const call = async (fn, ok) => {
        try {
            const { data } = await fn();
            apply(data);
            setFlash(data.message || ok);
        } catch (e) {
            const fe = fieldErrors(e);
            setFlash(Object.values(fe)[0] || e.response?.data?.message || errorMessage(e), 'danger');
            if (e.response?.data?.data) apply(e.response.data);
        }
    };

    if (!d) return <Page title="Currencies"><Spinner /></Page>;
    const s = d.status;

    return (
        <Page title="Currencies" crumbs={[{ label: 'Pricing' }, { label: 'Currencies' }]}>
            {flash}
            {s.last_error && <Callout type="danger">Last API error: {s.last_error.message} ({formatDate(s.last_error.at)}). The last good API rates stay in use.</Callout>}
            <Card title="Exchange-rate source" outline="info">
                <div className="d-flex flex-wrap align-items-center gap-3">
                    <div>Using: <StatusBadge value={s.source} /></div>
                    <div className="btn-group">
                        <button className={`btn btn-sm ${s.source === 'manual' ? 'btn-secondary' : 'btn-outline-secondary'}`} disabled={s.source === 'manual'} onClick={() => call(() => api.put('/pricing/currencies/settings', { source: 'manual' }), 'Using manual rates.')}>Manual</button>
                        <button className={`btn btn-sm ${s.source === 'api' ? 'btn-info' : 'btn-outline-info'}`} disabled={s.source === 'api' || !s.has_api_rates} title={!s.has_api_rates ? 'Fetch successfully first' : ''} onClick={() => call(() => api.put('/pricing/currencies/settings', { source: 'api' }), 'Using API rates.')}>API</button>
                    </div>
                    <button className="btn btn-sm btn-warning" onClick={() => call(() => api.post('/pricing/currencies/fetch'), 'Fetched.')}><i className="bi bi-cloud-download" /> Test & fetch now</button>
                    <div className="input-group input-group-sm" style={{ width: 260 }}>
                        <span className="input-group-text">Interval (min)</span>
                        <input type="number" className="form-control" value={interval} onChange={(e) => setInterval_(e.target.value)} />
                        <button className="btn btn-outline-primary" onClick={() => call(() => api.put('/pricing/currencies/settings', { fetch_interval_minutes: Number(interval) }), 'Saved.')}>Save</button>
                    </div>
                    <div className="small text-secondary">Last API success: {formatDate(s.last_api_success_at)}</div>
                </div>
            </Card>
            <Card noBody title="Currencies (1 EUR = rate × currency)">
                <table className="table align-middle mb-0">
                    <thead><tr><th>Code</th><th>Name</th><th>Enabled</th><th>Manual rate</th><th>API rate</th><th>In use</th></tr></thead>
                    <tbody>
                        {d.currencies.map((c) => (
                            <tr key={c.code}>
                                <td><strong>{c.code}</strong> {c.symbol}{c.is_base && <span className="badge text-bg-primary ms-1">base</span>}</td>
                                <td>{c.name}</td>
                                <td>
                                    <div className="form-check form-switch">
                                        <input className="form-check-input" type="checkbox" disabled={c.is_base} checked={c.is_active} onChange={(e) => call(() => api.put(`/pricing/currencies/${c.code}`, { is_active: e.target.checked }), 'Saved.')} />
                                    </div>
                                </td>
                                <td style={{ width: 260 }}>
                                    {c.is_base ? '1' : (
                                        <div className="input-group input-group-sm">
                                            <input type="number" step="0.0001" className="form-control" value={rates[c.code]} onChange={(e) => setRates({ ...rates, [c.code]: e.target.value })} />
                                            <button className="btn btn-outline-primary" onClick={() => call(() => api.put(`/pricing/currencies/${c.code}`, { manual_rate: Number(rates[c.code]) }), 'Rate saved.')}>Save</button>
                                        </div>
                                    )}
                                    {!c.is_base && <div className="small text-secondary">{formatDate(c.manual_updated_at)}</div>}
                                </td>
                                <td>{c.api_rate ?? '—'}<div className="small text-secondary">{c.api_fetched_at && formatDate(c.api_fetched_at)}</div></td>
                                <td><strong>{c.rate_in_use ?? '—'}</strong></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
            <p className="small text-secondary">Prices are converted per unit with <code>round(eur_minor × rate)</code>; Stripe charges in the order's currency.</p>
        </Page>
    );
}
