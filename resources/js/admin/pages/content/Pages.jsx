import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { Icon, Page, Spinner, useFlash } from '../../components/ui';
import { Check, Input, Textarea } from '../../components/form';
import SchemaEditor from '../../components/SchemaEditor';

const SECTIONS = { type: 'list', label: 'section', newItem: { heading: '', body: [''] }, of: { type: 'object', fields: [
    { key: 'heading', label: 'Heading', schema: 'text', col: 'md:col-span-8' },
    { key: 'id', label: 'Anchor id (optional)', schema: 'text', col: 'md:col-span-4' },
    { key: 'body', label: 'Paragraphs', schema: { type: 'list', label: 'paragraph', of: 'textarea' } },
] } };

export default function Pages() {
    const [list, setList] = useState(null);
    const [p, setP] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useFlash();

    const load = (selectId) => api.get('/content/pages', { params: { all: 1 } }).then(({ data }) => {
        setList(data.data);
        const pick = data.data.find((x) => x.id === selectId) || data.data[0];
        if (pick) setP(structuredClone(pick));
    });
    useEffect(() => { load(); }, []);

    const save = async () => {
        setErrors({});
        setSaving(true);
        try {
            const { data } = p.id ? await api.put(`/content/pages/${p.id}`, p) : await api.post('/content/pages', p);
            setFlash('Page saved.');
            load(data.data.id);
        } catch (e) {
            setErrors(fieldErrors(e));
            setFlash(errorMessage(e), 'danger');
        } finally {
            setSaving(false);
        }
    };

    if (!list) return <Page title="Policy pages" crumbs={[{ label: 'Content' }]}><Spinner /></Page>;
    const b = (k) => ({ value: p?.[k], onChange: (v) => setP({ ...p, [k]: v }), error: errors[k] });

    return (
        <Page title="Policy pages" crumbs={[{ label: 'Content' }, { label: 'Pages' }]}
            actions={<>
                <button className="kt-btn kt-btn-outline" onClick={() => setP({ slug: '', title: '', sections: [], is_active: true })}><Icon name="plus" /> New page</button>
                {p && <button className="kt-btn kt-btn-primary" onClick={save} disabled={saving}><Icon name="check" /> {saving ? 'Saving…' : 'Save page'}</button>}
            </>}>
            {flash}
            <div className="flex flex-col lg:flex-row gap-5 lg:gap-7.5 items-start">
                <div className="kt-card w-full lg:w-[280px] shrink-0">
                    <div className="kt-card-content p-2.5 flex flex-col gap-0.5">
                        {list.map((x) => (
                            <button key={x.id} type="button" onClick={() => setP(structuredClone(x))}
                                className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-start transition-colors ${p?.id === x.id ? 'bg-primary/10' : 'hover:bg-accent'}`}>
                                <Icon name="document" className={`text-lg ${p?.id === x.id ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className="flex flex-col grow min-w-0">
                                    <span className={`text-sm truncate ${p?.id === x.id ? 'text-primary font-medium' : 'text-mono'}`}>{x.title}</span>
                                    <span className="text-xs text-secondary-foreground">/{x.slug}</span>
                                </span>
                                {!x.is_active && <span className="kt-badge kt-badge-sm kt-badge-secondary">off</span>}
                            </button>
                        ))}
                    </div>
                </div>
                {p && (
                    <div className="grid gap-5 lg:gap-7.5 grow w-full min-w-0">
                        <div className="kt-card">
                            <div className="kt-card-header"><h3 className="kt-card-title">{p.id ? p.title : 'New page'}</h3><Check className="mb-0" label="Active" checked={p.is_active} onChange={(v) => setP({ ...p, is_active: v })} /></div>
                            <div className="kt-card-content grid md:grid-cols-3 gap-x-5">
                                <Input className="mb-4 md:col-span-2" label="Title" {...b('title')} />
                                <Input label="Slug" {...b('slug')} />
                                <Input label="Eyebrow" {...b('eyebrow')} />
                                <Input className="mb-4 md:col-span-2" label="Updated label" {...b('updated_label')} help='e.g. "1 October 2026"' />
                                <Textarea className="mb-0 md:col-span-3" label="Intro" {...b('intro')} />
                            </div>
                        </div>
                        <div className="kt-card">
                            <div className="kt-card-header"><h3 className="kt-card-title">Sections</h3><span className="kt-badge kt-badge-sm kt-badge-outline">{p.sections?.length || 0}</span></div>
                            <div className="kt-card-content">
                                {Object.entries(errors).filter(([k]) => k.startsWith('sections')).map(([k, v]) => <div key={k} className="text-xs text-destructive mb-2">{v}</div>)}
                                <SchemaEditor schema={SECTIONS} value={p.sections} onChange={(v) => setP({ ...p, sections: v })} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Page>
    );
}
