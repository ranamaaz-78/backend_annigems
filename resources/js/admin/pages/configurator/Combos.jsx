import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api';
import { Card, Page, Spinner, useFlash } from '../../components/ui';
import { ImageInput } from '../../components/form';

export default function Combos() {
    const [d, setD] = useState(null);
    const [flash, setFlash] = useFlash();
    const load = () => api.get('/configurator/combos').then(({ data }) => setD(data.data));
    useEffect(() => { load(); }, []);

    const save = async (ring, stone, patch) => {
        try {
            const { data } = await api.put('/configurator/combos', { ring_id: ring.id, stone_id: stone.id, ...patch });
            setD((s) => ({ ...s, combos: [...s.combos.filter((c) => !(c.ring_id === ring.id && c.stone_id === stone.id)), data.data] }));
        } catch (e) {
            setFlash(errorMessage(e), 'danger');
        }
    };

    if (!d) return <Page title="Combos matrix"><Spinner /></Page>;
    const combo = (r, s) => d.combos.find((c) => c.ring_id === r.id && c.stone_id === s.id) || { is_active: false };

    return (
        <Page title="Combos matrix" crumbs={[{ label: 'Design Your Ring' }, { label: 'Combos' }]}>
            {flash}
            <p className="text-secondary">A stone is offered for a ring only when the combo is active <strong>and</strong> both ring and stone are active. Without a combo image the ring image is used.</p>
            <Card noBody>
                <div className="table-responsive">
                    <table className="table table-bordered align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Ring \ Stone</th>
                                {d.stones.map((s) => (
                                    <th key={s.id} className="text-center combo-cell">
                                        <span className="d-inline-block rounded-circle me-1" style={{ width: 12, height: 12, background: s.color }} />{s.name}
                                        {!s.is_active && <div><span className="badge text-bg-secondary">stone inactive</span></div>}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {d.rings.map((r) => (
                                <tr key={r.id}>
                                    <th className="text-nowrap">
                                        {r.image_url && <img src={r.image_url} alt="" className="rounded me-2" style={{ width: 36, height: 36, objectFit: 'cover' }} />}{r.name}
                                        {!r.is_active && <div><span className="badge text-bg-secondary">ring inactive</span></div>}
                                    </th>
                                    {d.stones.map((s) => {
                                        const c = combo(r, s);
                                        const offered = c.is_active && r.is_active && s.is_active;
                                        return (
                                            <td key={s.id} className={`text-center combo-cell ${offered ? 'table-success' : ''}`}>
                                                <div className="form-check form-switch d-inline-block">
                                                    <input className="form-check-input" type="checkbox" checked={!!c.is_active} onChange={(e) => save(r, s, { is_active: e.target.checked })} />
                                                </div>
                                                <div className="d-flex justify-content-center mt-1">
                                                    <ImageInput small value={c.image} folder="combos" onChange={(v) => save(r, s, { image: v })} />
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </Page>
    );
}
