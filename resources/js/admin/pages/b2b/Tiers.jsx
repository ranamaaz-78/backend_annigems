import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { Callout, Card, Icon, Modal, Page, Skeleton, useFlash } from '../../components/ui';
import { Check, Input } from '../../components/form';
import { B2B_CRUMB, useTiers } from './shared';

const RING = 'ring';

/**
 * Membership tiers (Platinum, Gold, Silver…) and their discount % per category, plus the
 * Design Your Ring row. One matrix: rows = categories, columns = tiers. Saved per tier.
 */
export default function Tiers() {
    const [reload, setReload] = useState(0);
    const { tiers, categories } = useTiers(reload);
    const [matrix, setMatrix] = useState(null); // {tierId: {categoryId|'ring': percent}}
    const [dirty, setDirty] = useState({});
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(null);
    const [errors, setErrors] = useState({});
    const [flash, setFlash] = useFlash();

    useEffect(() => {
        if (!tiers.length && !categories.length) return;
        setMatrix(Object.fromEntries(tiers.map((t) => [t.id, { ...t.discounts }])));
        setDirty({});
    }, [tiers, categories]);

    const rows = [...categories.map((c) => ({ key: String(c.id), label: c.name, inactive: !c.is_active })), { key: RING, label: 'Design Your Ring (custom rings)', ring: true }];

    const setCell = (tierId, key, v) => {
        setMatrix((m) => ({ ...m, [tierId]: { ...m[tierId], [key]: v } }));
        setDirty((d) => ({ ...d, [tierId]: true }));
    };

    const saveAll = async () => {
        setSaving(true);
        try {
            for (const t of tiers.filter((x) => dirty[x.id])) {
                const discounts = rows.map((r) => ({ category_id: r.ring ? null : Number(r.key), percent: Number(matrix[t.id]?.[r.key] || 0) }));
                await api.put(`/b2b/tiers/${t.id}/discounts`, { discounts });
            }
            setFlash('Discounts saved. New prices apply right away; placed orders keep theirs.');
            setReload((r) => r + 1);
        } catch (e) {
            const fe = fieldErrors(e);
            setFlash(fe[Object.keys(fe)[0]] || errorMessage(e), 'danger');
        } finally {
            setSaving(false);
        }
    };

    const saveTier = async () => {
        setErrors({});
        try {
            const body = { name: editing.name, sort_order: editing.sort_order === '' ? null : editing.sort_order, is_active: !!editing.is_active };
            if (editing.id) await api.put(`/b2b/tiers/${editing.id}`, body);
            else await api.post('/b2b/tiers', body);
            setEditing(null);
            setReload((r) => r + 1);
            setFlash('Tier saved.');
        } catch (e) {
            setErrors(fieldErrors(e));
            if (!e.response?.data?.errors) setFlash(errorMessage(e), 'danger');
        }
    };

    const removeTier = async (t) => {
        if (!window.confirm(`Delete the ${t.name} tier?`)) return;
        try {
            await api.delete(`/b2b/tiers/${t.id}`);
            setReload((r) => r + 1);
            setFlash('Tier deleted.');
        } catch (e) {
            const fe = fieldErrors(e);
            setFlash(fe[Object.keys(fe)[0]] || errorMessage(e), 'danger');
        }
    };

    const anyDirty = Object.values(dirty).some(Boolean);

    return (
        <Page
            title="Membership tiers"
            crumbs={[B2B_CRUMB, { label: 'Membership tiers' }]}
            actions={<>
                <button className="kt-btn kt-btn-outline" onClick={() => { setErrors({}); setEditing({ name: '', sort_order: '', is_active: true }); }}><Icon name="plus" /> New tier</button>
                <button className="kt-btn kt-btn-primary" disabled={!anyDirty || saving} onClick={saveAll}><Icon name="check" /> {saving ? 'Saving…' : 'Save discounts'}</button>
            </>}
        >
            {flash}
            <Callout type="info">
                Each business has one tier. It sees prices with these discounts on the website, e.g. 40% turns €100 into €60.
                A category left at 0% has no discount. Commission is calculated on the discounted price.
            </Callout>

            {!matrix ? <Skeleton className="h-72" /> : (
                <Card title="Discount % per category" noBody>
                    <div className="kt-scrollable-x-auto">
                        <table className="kt-table kt-table-border align-middle">
                            <thead>
                                <tr>
                                    <th className="min-w-56">Category</th>
                                    {tiers.map((t) => (
                                        <th key={t.id} className="text-center min-w-36">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Icon name="crown-2" className="text-yellow-600" />
                                                <span className={t.is_active ? 'text-mono' : 'text-muted-foreground line-through'}>{t.name}</span>
                                                <button type="button" className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost" title="Edit tier" onClick={() => { setErrors({}); setEditing({ ...t }); }}><Icon name="notepad-edit" /></button>
                                                {t.businesses_count === 0 && <button type="button" className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost text-destructive" title="Delete tier" onClick={() => removeTier(t)}><Icon name="trash" /></button>}
                                            </div>
                                            <div className="text-xs font-normal text-secondary-foreground">{t.businesses_count} business{t.businesses_count === 1 ? '' : 'es'}{dirty[t.id] && <span className="text-yellow-600"> · unsaved</span>}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.key} className={r.ring ? 'bg-muted/30' : ''}>
                                        <td className="text-sm font-medium text-mono">
                                            {r.ring && <Icon name="crown" className="me-1.5 text-yellow-600" />}{r.label}
                                            {r.inactive && <span className="kt-badge kt-badge-sm kt-badge-outline ms-2">hidden</span>}
                                        </td>
                                        {tiers.map((t) => (
                                            <td key={t.id} className="text-center">
                                                <div className="kt-input-group kt-input-group-sm w-28 mx-auto">
                                                    <input
                                                        type="number" min="0" max="100" step="0.5" className="kt-input kt-input-sm text-end"
                                                        aria-label={`${t.name} discount for ${r.label}`}
                                                        value={matrix[t.id]?.[r.key] ?? ''}
                                                        placeholder="0"
                                                        onChange={(e) => setCell(t.id, r.key, e.target.value)}
                                                    />
                                                    <span className="kt-input-addon">%</span>
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Modal show={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.name}` : 'New tier'} size="sm"
                footer={<><button className="kt-btn kt-btn-outline" onClick={() => setEditing(null)}>Cancel</button><button className="kt-btn kt-btn-primary" onClick={saveTier}><Icon name="check" /> Save</button></>}>
                {editing && (
                    <>
                        <Input label="Name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} error={errors.name} />
                        <Input label="Sort order" type="number" value={editing.sort_order} onChange={(v) => setEditing({ ...editing, sort_order: v })} error={errors.sort_order} />
                        <Check label="Active (can be chosen when onboarding)" checked={editing.is_active} onChange={(v) => setEditing({ ...editing, is_active: v })} />
                    </>
                )}
            </Modal>
        </Page>
    );
}
