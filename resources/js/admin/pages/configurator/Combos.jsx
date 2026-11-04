import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api';
import { Callout, Icon, Page, Spinner, useFlash } from '../../components/ui';
import { ImageInput } from '../../components/form';

export default function Combos() {
    const [d, setD] = useState(null);
    const [flash, setFlash] = useFlash();
    useEffect(() => { api.get('/configurator/combos').then(({ data }) => setD(data.data)); }, []);

    const save = async (ring, stone, patch) => {
        try {
            const { data } = await api.put('/configurator/combos', { ring_id: ring.id, stone_id: stone.id, ...patch });
            setD((s) => ({ ...s, combos: [...s.combos.filter((c) => !(c.ring_id === ring.id && c.stone_id === stone.id)), data.data] }));
        } catch (e) {
            setFlash(errorMessage(e), 'danger');
        }
    };

    if (!d) return <Page title="Combos matrix" crumbs={[{ label: 'Design Your Ring' }]}><Spinner /></Page>;
    const combo = (r, s) => d.combos.find((c) => c.ring_id === r.id && c.stone_id === s.id) || { is_active: false };
    const offered = d.rings.reduce((n, r) => n + d.stones.filter((s) => combo(r, s).is_active && r.is_active && s.is_active).length, 0);

    return (
        <Page title="Combos matrix" crumbs={[{ label: 'Design Your Ring' }, { label: 'Combos' }]}
            actions={<span className="kt-badge kt-badge-success kt-badge-outline"><Icon name="check-circle" /> {offered} combos offered</span>}>
            {flash}
            <Callout type="info">A stone is offered for a ring only when the combo is on <b>and</b> both ring and stone are active. Without a combo image the ring image is used.</Callout>
            <div className="kt-card kt-card-grid min-w-full">
                <div className="kt-card-header"><h3 className="kt-card-title">Rings × stones</h3></div>
                <div className="kt-card-table">
                    <div className="kt-scrollable-x-auto">
                        <table className="kt-table kt-table-border align-middle">
                            <thead>
                                <tr>
                                    <th className="min-w-[220px]">Ring \ Stone</th>
                                    {d.stones.map((s) => (
                                        <th key={s.id} className="text-center min-w-[160px]">
                                            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full border border-black/10" style={{ background: s.color }} />{s.name}</span>
                                            {!s.is_active && <div><span className="kt-badge kt-badge-sm kt-badge-secondary mt-1">stone inactive</span></div>}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {d.rings.map((r) => (
                                    <tr key={r.id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                {r.image_url && <img src={r.image_url} alt="" className="size-11 rounded-lg object-cover border border-border" />}
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-mono">{r.name}</span>
                                                    {!r.is_active && <span className="kt-badge kt-badge-sm kt-badge-secondary w-fit">ring inactive</span>}
                                                </div>
                                            </div>
                                        </td>
                                        {d.stones.map((s) => {
                                            const c = combo(r, s);
                                            const on = c.is_active && r.is_active && s.is_active;
                                            return (
                                                <td key={s.id} className={`text-center transition-colors ${on ? 'bg-green-500/5' : ''}`}>
                                                    <div className="flex flex-col items-center gap-2">
                                                        <input type="checkbox" className="kt-switch" checked={!!c.is_active} onChange={(e) => save(r, s, { is_active: e.target.checked })} title="Offer this combo" />
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
                </div>
            </div>
        </Page>
    );
}
