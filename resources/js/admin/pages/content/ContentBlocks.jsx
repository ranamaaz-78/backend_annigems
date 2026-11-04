import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../../api';
import { Icon, Page, Spinner, formatDate, useFlash } from '../../components/ui';
import SchemaEditor, { BLOCK_SCHEMAS } from '../../components/SchemaEditor';

const GROUP_ICON = { General: 'element-11', Home: 'home-3', Navigation: 'burger-menu-2', Footer: 'row-horizontal', 'Product page': 'diamonds', Configurator: 'crown', Catalog: 'category' };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export default function ContentBlocks() {
    const [params, setParams] = useSearchParams();
    const [blocks, setBlocks] = useState(null);
    const [value, setValue] = useState(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useFlash();
    const key = params.get('key') || 'home.hero';

    useEffect(() => { api.get('/content/blocks').then(({ data }) => setBlocks(data.data)); }, []);
    useEffect(() => {
        if (!blocks) return;
        setValue(structuredClone(blocks.find((b) => b.key === key)?.value ?? null));
        setDirty(false);
    }, [key, blocks]);

    const select = (k) => {
        if (dirty && !window.confirm('Discard unsaved changes?')) return;
        setParams({ key: k });
    };

    const save = async () => {
        setSaving(true);
        try {
            const { data } = await api.put(`/content/blocks/${key}`, { value });
            setBlocks(blocks.map((b) => (b.key === key ? { ...b, value: data.data.value, updated_at: new Date().toISOString() } : b)));
            setFlash('Saved. The storefront picks it up on its next request.');
        } catch (e) {
            setFlash(fieldErrors(e).value || errorMessage(e), 'danger');
        } finally {
            setSaving(false);
        }
    };

    if (!blocks) return <Page title="Content blocks" crumbs={[{ label: 'Content' }]}><Spinner /></Page>;
    const block = blocks.find((b) => b.key === key);
    const groups = blocks.reduce((acc, b) => {
        const g = b.label.includes(':') ? b.label.split(':')[0] : 'General';
        (acc[g] ||= []).push(b);
        return acc;
    }, {});

    return (
        <Page title="Content blocks" crumbs={[{ label: 'Content' }, { label: 'Blocks' }]}
            actions={<button className="kt-btn kt-btn-primary" onClick={save} disabled={saving || !dirty}><Icon name="check" /> {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>}>
            {flash}
            <div className="flex flex-col lg:flex-row gap-5 lg:gap-7.5 items-start">
                <div className="kt-card w-full lg:w-[280px] shrink-0 lg:sticky lg:top-0">
                    <div className="kt-card-content p-2.5 flex flex-col gap-3">
                        {Object.entries(groups).map(([g, list]) => (
                            <div key={g}>
                                <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground uppercase font-medium"><Icon name={GROUP_ICON[g] || 'element-11'} /> {g}</div>
                                <div className="flex flex-col gap-0.5">
                                    {list.map((b) => (
                                        <button key={b.key} type="button" onClick={() => select(b.key)}
                                            className={`flex items-center justify-between rounded-md px-2.5 py-2 text-sm text-start transition-colors ${b.key === key ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-accent'}`}>
                                            {cap(b.label.includes(':') ? b.label.split(':')[1].trim() : b.label)}
                                            {b.key === key && dirty && <span className="size-1.5 rounded-full bg-yellow-500" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="kt-card grow w-full min-w-0">
                    <div className="kt-card-header">
                        <div className="flex flex-col">
                            <h3 className="kt-card-title">{block.label}</h3>
                            <span className="text-xs text-secondary-foreground font-mono">{key}</span>
                        </div>
                        <span className="text-xs text-secondary-foreground">Last saved {formatDate(block.updated_at)}{block.updated_by && ` by ${block.updated_by}`}</span>
                    </div>
                    <div className="kt-card-content">
                        {BLOCK_SCHEMAS[key] ? (
                            <SchemaEditor schema={BLOCK_SCHEMAS[key]} value={value} onChange={(v) => { setValue(v); setDirty(true); }} />
                        ) : <p className="text-sm">No editor for this block.</p>}
                    </div>
                    <div className="kt-card-footer justify-end">
                        <button className="kt-btn kt-btn-primary" onClick={save} disabled={saving || !dirty}><Icon name="check" /> Save changes</button>
                    </div>
                </div>
            </div>
        </Page>
    );
}
