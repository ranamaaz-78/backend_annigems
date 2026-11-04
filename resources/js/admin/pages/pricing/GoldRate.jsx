import { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import api, { errorMessage, fieldErrors } from '../../api';
import { Callout, Card, Icon, Page, Row, Spinner, StatusBadge, eur, formatDate, useFlash } from '../../components/ui';
import { Input, MoneyInput } from '../../components/form';

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

    if (!d) return <Page title="Gold rate" crumbs={[{ label: 'Pricing' }]}><Spinner /></Page>;
    const s = d.status;
    const series = [...d.history].reverse();
    const dark = document.documentElement.classList.contains('dark');

    return (
        <Page title="Gold rate" crumbs={[{ label: 'Pricing' }, { label: 'Gold rate' }]}
            actions={<button className="kt-btn kt-btn-outline" disabled={busy} onClick={fetchNow}><Icon name={busy ? 'loading' : 'cloud-download'} className={busy ? 'animate-spin' : ''} /> Test & fetch now</button>}>
            {flash}
            {s.warning && <Callout type="danger" title="API warning">{s.warning}{s.last_error && <span className="block text-xs mt-1">Last error: {s.last_error.message} ({formatDate(s.last_error.at)})</span>}</Callout>}

            <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-start">
                <div className="grid gap-5 lg:gap-7.5">
                    <div className="kt-card overflow-hidden">
                        <div className="kt-card-content flex flex-col gap-4 bg-gradient-to-br from-yellow-500/15 via-transparent to-transparent">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center size-12 rounded-xl bg-yellow-500/15 border border-yellow-500/30"><Icon name="crown-2" className="text-2xl text-yellow-600" /></span>
                                <div className="flex flex-col">
                                    <span className="text-sm text-secondary-foreground">Rate in use</span>
                                    <span className="text-3xl font-semibold text-mono leading-none">{eur(s.per_oz)}<span className="text-sm font-normal text-secondary-foreground">/oz</span></span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-secondary-foreground"><StatusBadge value={s.source} /> updated {formatDate(s.updated_at)}</div>
                            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                                <button type="button" className={`kt-btn kt-btn-sm justify-center transition-all ${s.source === 'manual' ? 'kt-btn-mono' : 'kt-btn-ghost'}`} disabled={busy || s.source === 'manual'} onClick={() => save({ source: 'manual' }, 'Switched to manual.')}><Icon name="pencil" /> Manual</button>
                                <button type="button" className={`kt-btn kt-btn-sm justify-center transition-all ${s.source === 'api' ? 'kt-btn-mono' : 'kt-btn-ghost'}`} disabled={busy || s.source === 'api' || !s.can_use_api} title={!s.can_use_api ? 'Run "Test & fetch now" successfully first' : ''} onClick={() => save({ source: 'api' }, 'Switched to API.')}><Icon name="cloud" /> API</button>
                            </div>
                            {!s.can_use_api && <span className="text-xs text-secondary-foreground">API can be selected after a successful "Test & fetch now". There is no automatic switching between sources.</span>}
                        </div>
                    </div>
                    <Card title="Manual rate" description="Used while the source is Manual">
                        <MoneyInput label="EUR per troy ounce" value={form.manual_rate_per_oz} onChange={(v) => setForm({ ...form, manual_rate_per_oz: v })} />
                        <button className="kt-btn kt-btn-primary" disabled={busy} onClick={() => save({ manual_rate_per_oz: form.manual_rate_per_oz }, 'Manual rate saved.')}><Icon name="check" /> Save manual rate</button>
                    </Card>
                    <Card title={`Provider: ${s.provider}`}>
                        <Row label="API key">{s.api_key_configured ? <span className="kt-badge kt-badge-sm kt-badge-success kt-badge-outline">configured</span> : <span className="kt-badge kt-badge-sm kt-badge-destructive kt-badge-outline">GOLD_API_KEY missing</span>}</Row>
                        <Row label="Last good API rate">{s.last_api_rate ? <>{eur(s.last_api_rate.per_oz)}<span className="block text-xs text-muted-foreground">{formatDate(s.last_api_rate.fetched_at)}</span></> : '—'}</Row>
                        <Row label="Consecutive failures"><span className={s.consecutive_failures ? 'text-destructive font-semibold' : ''}>{s.consecutive_failures}</span></Row>
                        <div className="border-t border-border my-3" />
                        <Input label="Fetch interval (minutes)" type="number" icon="time" value={form.fetch_interval_minutes} onChange={(v) => setForm({ ...form, fetch_interval_minutes: v })} help="Mind the provider's monthly quota. Fetches only run while the source is API." />
                        <button className="kt-btn kt-btn-outline" disabled={busy} onClick={() => save({ fetch_interval_minutes: form.fetch_interval_minutes }, 'Interval saved.')}>Save interval</button>
                    </Card>
                </div>
                <div className="lg:col-span-2 grid gap-5 lg:gap-7.5">
                    <Card title="History, 90 days" description="EUR per troy ounce">
                        {series.length > 1 ? (
                            <Chart type="line" height={300}
                                series={[
                                    { name: 'API', data: series.map((h) => (h.source === 'api' ? h.rate_per_oz / 100 : null)) },
                                    { name: 'Manual', data: series.map((h) => (h.source === 'manual' ? h.rate_per_oz / 100 : null)) },
                                ]}
                                options={{
                                    chart: { toolbar: { show: false }, fontFamily: 'Inter, sans-serif', zoom: { enabled: false } },
                                    stroke: { curve: 'stepline', width: 2.5 },
                                    colors: ['#8b5cf6', '#71717a'],
                                    xaxis: { categories: series.map((h) => h.fetched_at.slice(5, 16).replace('T', ' ')), labels: { show: false }, axisTicks: { show: false } },
                                    yaxis: { labels: { formatter: (v) => (v === null ? '' : `€${Math.round(v)}`) } },
                                    grid: { borderColor: dark ? '#27272a' : '#f1f1f4', strokeDashArray: 5 },
                                    legend: { position: 'top', horizontalAlign: 'right' },
                                    tooltip: { theme: dark ? 'dark' : 'light' },
                                    markers: { size: 3 },
                                    noData: { text: 'No data' },
                                }}
                            />
                        ) : <p className="text-sm text-secondary-foreground">Not enough data for a chart yet.</p>}
                    </Card>
                    <div className="kt-card kt-card-grid min-w-full">
                        <div className="kt-card-header"><h3 className="kt-card-title">Entries</h3><span className="kt-badge kt-badge-sm kt-badge-outline">{d.history.length}</span></div>
                        <div className="kt-card-table">
                            <div className="kt-scrollable-y-auto max-h-[420px]">
                                <table className="kt-table kt-table-border">
                                    <thead><tr><th>When</th><th>Source</th><th>Provider</th><th className="text-end">Rate / oz</th></tr></thead>
                                    <tbody>
                                        {d.history.map((h) => (
                                            <tr key={h.id}>
                                                <td className="text-sm text-secondary-foreground">{formatDate(h.fetched_at)}</td>
                                                <td><StatusBadge value={h.source} /></td>
                                                <td className="text-sm">{h.provider || '—'}</td>
                                                <td className="text-end text-sm font-medium text-mono">{eur(h.rate_per_oz)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Page>
    );
}
