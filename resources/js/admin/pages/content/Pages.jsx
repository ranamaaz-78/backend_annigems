import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { ActiveBadge, Card, Page, Spinner, useFlash } from '../../components/ui';
import { Check, Input, Textarea } from '../../components/form';
import SchemaEditor from '../../components/SchemaEditor';

const SECTIONS = { type: 'list', label: 'section', newItem: { heading: '', body: [''] }, of: { type: 'object', fields: [
    { key: 'heading', label: 'Heading', schema: 'text', col: 'col-md-8' },
    { key: 'id', label: 'Anchor id (optional)', schema: 'text', col: 'col-md-4' },
    { key: 'body', label: 'Paragraphs', schema: { type: 'list', label: 'paragraph', of: 'textarea' } },
] } };

export default function Pages() {
    const [list, setList] = useState(null);
    const [p, setP] = useState(null);
    const [errors, setErrors] = useState({});
    const [flash, setFlash] = useFlash();

    const load = (selectId) => api.get('/content/pages', { params: { all: 1 } }).then(({ data }) => {
        setList(data.data);
        const pick = data.data.find((x) => x.id === selectId) || data.data[0];
        if (pick) setP(structuredClone(pick));
    });
    useEffect(() => { load(); }, []);

    const save = async () => {
        setErrors({});
        try {
            const { data } = p.id ? await api.put(`/content/pages/${p.id}`, p) : await api.post('/content/pages', p);
            setFlash('Page saved.');
            load(data.data.id);
        } catch (e) {
            setErrors(fieldErrors(e));
            setFlash(errorMessage(e), 'danger');
        }
    };

    if (!list) return <Page title="Policy pages"><Spinner /></Page>;
    const b = (k) => ({ value: p?.[k], onChange: (v) => setP({ ...p, [k]: v }), error: errors[k] });

    return (
        <Page title="Policy pages" crumbs={[{ label: 'Content' }, { label: 'Pages' }]}>
            {flash}
            <div className="row">
                <div className="col-lg-3">
                    <Card noBody tools={<button className="btn btn-sm btn-outline-primary" onClick={() => setP({ slug: '', title: '', sections: [], is_active: true })}><i className="bi bi-plus" /> New</button>} title="Pages">
                        <div className="list-group list-group-flush">
                            {list.map((x) => (
                                <button key={x.id} className={`list-group-item list-group-item-action d-flex justify-content-between ${p?.id === x.id ? 'active' : ''}`} onClick={() => setP(structuredClone(x))}>
                                    <span>{x.title}<div className="small opacity-75">/{x.slug}</div></span>
                                    {!x.is_active && <ActiveBadge active={false} />}
                                </button>
                            ))}
                        </div>
                    </Card>
                </div>
                <div className="col-lg-9">
                    {p && (
                        <Card title={p.id ? p.title : 'New page'} tools={<button className="btn btn-primary btn-sm" onClick={save}><i className="bi bi-save" /> Save</button>}>
                            <div className="row">
                                <div className="col-md-6"><Input label="Title" {...b('title')} /></div>
                                <div className="col-md-3"><Input label="Slug" {...b('slug')} /></div>
                                <div className="col-md-3"><Input label="Eyebrow" {...b('eyebrow')} /></div>
                                <div className="col-md-9"><Textarea label="Intro" {...b('intro')} /></div>
                                <div className="col-md-3"><Input label="Updated label" {...b('updated_label')} help='e.g. "1 October 2026"' /><Check label="Active" checked={p.is_active} onChange={(v) => setP({ ...p, is_active: v })} id="pg-active" /></div>
                            </div>
                            <h5 className="mt-2">Sections</h5>
                            {Object.entries(errors).filter(([k]) => k.startsWith('sections')).map(([k, v]) => <div key={k} className="text-danger small">{v}</div>)}
                            <SchemaEditor schema={SECTIONS} value={p.sections} onChange={(v) => setP({ ...p, sections: v })} />
                        </Card>
                    )}
                </div>
            </div>
        </Page>
    );
}
