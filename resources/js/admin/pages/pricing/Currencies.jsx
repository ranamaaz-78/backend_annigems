import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { Callout, Card, Icon, Page, Spinner, StatusBadge, formatDate, useFlash } from '../../components/ui';

export default function Currencies() {
    const [d, setD] = useState(null);
    const [rates, setRates] = useState({});
    const [interval, setInterval_] = useState('');
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useFlash();

    const apply = (data) => {
        setD(data.data);
        setRates(Object.fromEntries(data.data.currencies.map((c) => [c.code, c.manual_rate ?? ''])));
        setInterval_(data.data.status.fetch_interval_minutes);
    };
    useEffect(() => { api.get('/pricing/currencies').then(({ data }) => apply(data)); }, []);

    const call = async (fn, ok) => {
        setBusy(true);
        try {
            const { data } = await fn();
            apply(data);
            setFlash(data.message || ok);
        } catch (e) {
            const fe = fieldErrors(e);
            setFlash(Object.values(fe)[0] || e.response?.data?.message || errorMessage(e), 'danger');
            if (e.response?.data?.data) apply(e.response.data);
        } finally {
            setBusy(false);
        }
    };

    if (!d) return <Page title="Currencies" crumbs={[{ label: 'Pricing' }]}><Spinner /></Page>;
    const s = d.status;

    return (
        <Page title="Currencies" crumbs={[{ label: 'Pricing' }, { label: 'Currencies' }]}
            actions={<button className="kt-btn kt-btn-outline" disabled={busy} onClick={() => call(() => api.post('/pricing/currencies/fetch'), 'Fetched.')}><Icon name="cloud-download" /> Test & fetch now</button>}>
            {flash}
            {s.last_error && <Callout type="danger" title="Exchange-rate API">{s.last_error.message} ({formatDate(s.last_error.at)}). The last good API rates stay in use.</Callout>}
            <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5">
                <Card title="Rate source" description="Whichever is selected is always used">
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 mb-3">
                        <button type="button" className={`kt-btn kt-btn-sm justify-center ${s.source === 'manual' ? 'kt-btn-mono' : 'kt-btn-ghost'}`} disabled={busy || s.source === 'manual'} onClick={() => call(() => api.put('/pricing/currencies/settings', { source: 'manual' }), 'Using manual rates.')}><Icon name="pencil" /> Manual</button>
                        <button type="button" className={`kt-btn kt-btn-sm justify-center ${s.source === 'api' ? 'kt-btn-mono' : 'kt-btn-ghost'}`} disabled={busy || s.source === 'api' || !s.has_api_rates} title={!s.has_api_rates ? 'Fetch successfully first' : ''} onClick={() => call(() => api.put('/pricing/currencies/settings', { source: 'api' }), 'Using API rates.')}><Icon name="cloud" /> API</button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-secondary-foreground"><StatusBadge value={s.source} /> {s.stale && <span className="kt-badge kt-badge-sm kt-badge-destructive">stale</span>} Last API success: {formatDate(s.last_api_success_at)}</div>
                </Card>
                <Card title="Fetch interval" description="Minutes between API fetches">
                    <div className="kt-input-group">
                        <input type="number" className="kt-input" value={interval} onChange={(e) => setInterval_(e.target.value)} />
                        <span className="kt-input-addon">min</span>
                    </div>
                    <button className="kt-btn kt-btn-outline mt-3" disabled={busy} onClick={() => call(() => api.put('/pricing/currencies/settings', { fetch_interval_minutes: Number(interval) }), 'Interval saved.')}>Save interval</button>
                </Card>
                <Card title="How conversion works">
                    <p className="text-sm text-secondary-foreground">Prices are converted per unit with <code className="text-mono">round(eur_minor × rate)</code>, then totals are summed in the customer's currency. Stripe charges in the order's currency.</p>
                </Card>
            </div>
            <div className="kt-card kt-card-grid min-w-full">
                <div className="kt-card-header"><h3 className="kt-card-title">Currencies</h3><span className="text-sm text-secondary-foreground">1 EUR = rate × currency</span></div>
                <div className="kt-card-table">
                    <div className="kt-scrollable-x-auto">
                        <table className="kt-table kt-table-border align-middle">
                            <thead><tr><th>Currency</th><th>Enabled</th><th className="min-w-[230px]">Manual rate</th><th>API rate</th><th className="text-end">In use</th></tr></thead>
                            <tbody>
                                {d.currencies.map((c) => (
                                    <tr key={c.code}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center justify-center size-9 rounded-full bg-muted border border-border text-sm font-semibold text-mono">{c.symbol.length > 2 ? c.symbol.slice(0, 2) : c.symbol}</span>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-mono">{c.code} {c.is_base && <span className="kt-badge kt-badge-sm kt-badge-primary kt-badge-outline ms-1">base</span>}</span>
                                                    <span className="text-xs text-secondary-foreground">{c.name}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td><input type="checkbox" className="kt-switch" disabled={c.is_base || busy} checked={c.is_active} onChange={(e) => call(() => api.put(`/pricing/currencies/${c.code}`, { is_active: e.target.checked }), 'Saved.')} /></td>
                                        <td>
                                            {c.is_base ? <span className="text-sm">1</span> : (
                                                <div className="flex flex-col gap-1">
                                                    <div className="kt-input-group">
                                                        <input type="number" step="0.0001" className="kt-input kt-input-sm" value={rates[c.code]} onChange={(e) => setRates({ ...rates, [c.code]: e.target.value })} />
                                                        <button className="kt-btn kt-btn-sm kt-btn-outline" disabled={busy} onClick={() => call(() => api.put(`/pricing/currencies/${c.code}`, { manual_rate: Number(rates[c.code]) }), 'Rate saved.')}>Save</button>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{formatDate(c.manual_updated_at)}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="text-sm">{c.api_rate ?? '—'}<span className="block text-xs text-muted-foreground">{c.api_fetched_at && formatDate(c.api_fetched_at)}</span></td>
                                        <td className="text-end text-sm font-semibold text-mono">{c.rate_in_use ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Page>
    );
}
