import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api';
import { Alert, Card, Icon, Page, Row, Skeleton, eur, formatDate } from '../../components/ui';
import { GemSwatch } from './Stones';

export default function PricePreview() {
    const [rings, setRings] = useState([]);
    const [stones, setStones] = useState([]);
    const [sel, setSel] = useState({ ring_id: '', stone_id: '' });
    const [res, setRes] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.get('/configurator/rings', { params: { all: 1 } }).then(({ data }) => { setRings(data.data); setSel((s) => ({ ...s, ring_id: data.data[0]?.id || '' })); });
        api.get('/configurator/stones', { params: { all: 1 } }).then(({ data }) => { setStones(data.data); setSel((s) => ({ ...s, stone_id: data.data[0]?.id || '' })); });
    }, []);

    useEffect(() => {
        if (!sel.ring_id) return;
        api.post('/configurator/price-preview', { ring_id: sel.ring_id, stone_id: sel.stone_id || null })
            .then(({ data }) => { setRes(data.data); setError(null); })
            .catch((e) => setError(errorMessage(e)));
    }, [sel]);

    const e = res?.eur;
    const ring = rings.find((r) => String(r.id) === String(sel.ring_id));
    const stone = stones.find((s) => String(s.id) === String(sel.stone_id));

    return (
        <Page title="Price preview" crumbs={[{ label: 'Design Your Ring' }, { label: 'Price preview' }]}>
            <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-start">
                <div className="grid gap-5 lg:gap-7.5">
                    <Card title="Ring">
                        <div className="grid gap-2">
                            {rings.map((r) => (
                                <button key={r.id} type="button" onClick={() => setSel({ ...sel, ring_id: r.id })}
                                    className={`flex items-center gap-3 rounded-lg border p-2.5 text-start transition-all ${String(sel.ring_id) === String(r.id) ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}>
                                    {r.image_url && <img src={r.image_url} alt="" className="size-11 rounded-md object-cover" />}
                                    <span className="flex flex-col">
                                        <span className="text-sm font-medium text-mono">{r.name} {!r.is_active && <span className="kt-badge kt-badge-sm kt-badge-secondary">inactive</span>}</span>
                                        <span className="text-xs text-secondary-foreground">{r.karat}K · {r.gold_weight_g} g · craft {eur(r.craft_fee)}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </Card>
                    <Card title="Stone">
                        <div className="grid gap-2">
                            <button type="button" onClick={() => setSel({ ...sel, stone_id: '' })} className={`flex items-center gap-3 rounded-lg border p-2.5 text-start transition-all ${!sel.stone_id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}>
                                <span className="size-8 rounded-full border border-dashed border-input" /><span className="text-sm text-mono">No stone</span>
                            </button>
                            {stones.map((s) => (
                                <button key={s.id} type="button" onClick={() => setSel({ ...sel, stone_id: s.id })}
                                    className={`flex items-center gap-3 rounded-lg border p-2.5 text-start transition-all ${String(sel.stone_id) === String(s.id) ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}>
                                    <GemSwatch stone={s} size={32} />
                                    <span className="flex flex-col">
                                        <span className="text-sm font-medium text-mono">{s.name} {!s.is_active && <span className="kt-badge kt-badge-sm kt-badge-secondary">inactive</span>}</span>
                                        <span className="text-xs text-secondary-foreground">{s.rarity} · {eur(s.price)}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-2 grid gap-5 lg:gap-7.5">
                    <Alert>{error}</Alert>
                    {!e && !error && <div className="kt-card"><div className="kt-card-content grid gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5" />)}</div></div>}
                    {e && (
                        <>
                            <div className="kt-card overflow-hidden">
                                <div className="kt-card-content flex flex-col sm:flex-row gap-6 items-center bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent">
                                    {ring?.image_url && <img src={ring.image_url} alt="" className="size-32 rounded-xl object-cover border border-border shadow-sm" />}
                                    <div className="flex flex-col gap-1 grow">
                                        <span className="text-sm text-secondary-foreground">{ring?.name}{stone ? ` with ${stone.name}` : ''}</span>
                                        <span className="text-4xl font-semibold text-mono">{eur(e.total)}</span>
                                        <span className="flex items-center gap-2 text-xs text-secondary-foreground">
                                            <Icon name="crown-2" className="text-yellow-600" /> Gold {eur(e.gold_rate_per_oz)}/oz
                                            <span className="kt-badge kt-badge-sm kt-badge-outline">{res.gold}</span> {formatDate(res.gold_updated_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Card title="Breakdown (EUR)">
                                <Row label="Purity">{e.karat}K = {e.karat}/24 = {(e.purity * 100).toFixed(2)}%</Row>
                                <Row label={<>Gold value <span className="text-xs text-muted-foreground">= {e.gold_weight_g} g × {e.purity} × {eur(e.gold_rate_per_oz)} ÷ 31.1034768</span></>}>{eur(e.gold_value)}</Row>
                                <Row label="Craft fee">{eur(e.craft_fee)}</Row>
                                <Row label={<b className="text-mono">Ring charge</b>}><b>{eur(e.ring_charge)}</b></Row>
                                <Row label="Stone">{eur(e.stone_price)}</Row>
                                <div className="border-t border-border my-2" />
                                <Row label={<b className="text-mono">Total</b>}><span className="text-base font-semibold">{eur(e.total)}</span></Row>
                            </Card>
                            <div className="kt-card kt-card-grid min-w-full">
                                <div className="kt-card-header"><h3 className="kt-card-title">In every active currency</h3></div>
                                <div className="kt-card-table">
                                    <div className="kt-scrollable-x-auto">
                                        <table className="kt-table kt-table-border">
                                            <thead><tr><th>Currency</th><th className="text-end">Rate</th><th className="text-end">Gold</th><th className="text-end">Craft</th><th className="text-end">Ring charge</th><th className="text-end">Stone</th><th className="text-end">Total</th></tr></thead>
                                            <tbody>
                                                {res.currencies.map((c) => (
                                                    <tr key={c.currency}>
                                                        <td><span className="kt-badge kt-badge-sm kt-badge-outline">{c.currency}</span></td>
                                                        <td className="text-end text-sm">{c.rate}</td>
                                                        <td className="text-end text-sm">{c.gold_value.formatted}</td>
                                                        <td className="text-end text-sm">{c.craft_fee.formatted}</td>
                                                        <td className="text-end text-sm">{c.ring_charge.formatted}</td>
                                                        <td className="text-end text-sm">{c.stone_price.formatted}</td>
                                                        <td className="text-end text-sm font-semibold text-mono">{c.total.formatted}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Page>
    );
}
