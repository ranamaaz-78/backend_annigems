import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api';
import { Alert, Card, Page, eur, formatDate } from '../../components/ui';

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
    return (
        <Page title="Price preview" crumbs={[{ label: 'Design Your Ring' }, { label: 'Price preview' }]}>
            <div className="row">
                <div className="col-lg-4">
                    <Card title="Choose">
                        <label className="form-label">Ring</label>
                        <select className="form-select mb-3" value={sel.ring_id} onChange={(ev) => setSel({ ...sel, ring_id: ev.target.value })}>
                            {rings.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.karat}K, {r.gold_weight_g} g){!r.is_active && ' – inactive'}</option>)}
                        </select>
                        <label className="form-label">Stone</label>
                        <select className="form-select" value={sel.stone_id} onChange={(ev) => setSel({ ...sel, stone_id: ev.target.value })}>
                            <option value="">No stone</option>
                            {stones.map((s) => <option key={s.id} value={s.id}>{s.name} ({eur(s.price)}){!s.is_active && ' – inactive'}</option>)}
                        </select>
                    </Card>
                </div>
                <div className="col-lg-8">
                    <Alert>{error}</Alert>
                    {e && (
                        <>
                            <Card title="Breakdown (EUR)" outline="warning">
                                <table className="table table-sm mb-0">
                                    <tbody>
                                        <tr><td>Gold rate</td><td className="text-end">{eur(e.gold_rate_per_oz)}/oz <span className="badge text-bg-secondary">{res.gold}</span> <span className="small text-secondary">{formatDate(res.gold_updated_at)}</span></td></tr>
                                        <tr><td>Purity</td><td className="text-end">{e.karat}K = {e.karat}/24 = {(e.purity * 100).toFixed(2)}%</td></tr>
                                        <tr><td>Gold value = {e.gold_weight_g} g × {e.purity} × {eur(e.gold_rate_per_oz)} / 31.1034768</td><td className="text-end">{eur(e.gold_value)}</td></tr>
                                        <tr><td>Craft fee</td><td className="text-end">{eur(e.craft_fee)}</td></tr>
                                        <tr><td><strong>Ring charge</strong></td><td className="text-end"><strong>{eur(e.ring_charge)}</strong></td></tr>
                                        <tr><td>Stone</td><td className="text-end">{eur(e.stone_price)}</td></tr>
                                        <tr className="table-warning"><td><strong>Total</strong></td><td className="text-end"><strong>{eur(e.total)}</strong></td></tr>
                                    </tbody>
                                </table>
                            </Card>
                            <Card title="In every active currency" noBody>
                                <table className="table table-sm mb-0">
                                    <thead><tr><th>Currency</th><th className="text-end">Rate</th><th className="text-end">Gold</th><th className="text-end">Craft</th><th className="text-end">Ring charge</th><th className="text-end">Stone</th><th className="text-end">Total</th></tr></thead>
                                    <tbody>
                                        {res.currencies.map((c) => (
                                            <tr key={c.currency}>
                                                <td>{c.currency}</td><td className="text-end">{c.rate}</td><td className="text-end">{c.gold_value.formatted}</td><td className="text-end">{c.craft_fee.formatted}</td>
                                                <td className="text-end">{c.ring_charge.formatted}</td><td className="text-end">{c.stone_price.formatted}</td><td className="text-end fw-bold">{c.total.formatted}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </Page>
    );
}
