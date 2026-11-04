import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../../api';
import { Card, Page, Spinner, formatDate, useFlash } from '../../components/ui';
import SchemaEditor, { BLOCK_SCHEMAS } from '../../components/SchemaEditor';

export default function ContentBlocks() {
    const [params, setParams] = useSearchParams();
    const [blocks, setBlocks] = useState(null);
    const [value, setValue] = useState(null);
    const [dirty, setDirty] = useState(false);
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
        try {
            const { data } = await api.put(`/content/blocks/${key}`, { value });
            setBlocks(blocks.map((b) => (b.key === key ? { ...b, value: data.data.value, updated_at: new Date().toISOString() } : b)));
            setFlash('Saved. The storefront picks it up on its next request.');
        } catch (e) {
            setFlash(fieldErrors(e).value || errorMessage(e), 'danger');
        }
    };

    if (!blocks) return <Page title="Content blocks"><Spinner /></Page>;
    const block = blocks.find((b) => b.key === key);
    const groups = blocks.reduce((acc, b) => {
        const g = b.label.includes(':') ? b.label.split(':')[0] : 'General';
        (acc[g] ||= []).push(b);
        return acc;
    }, {});

    return (
        <Page title="Content blocks" crumbs={[{ label: 'Content' }, { label: 'Blocks' }]}>
            {flash}
            <div className="row">
                <div className="col-lg-3">
                    <Card noBody>
                        <div className="list-group list-group-flush">
                            {Object.entries(groups).map(([g, list]) => (
                                <div key={g}>
                                    <div className="list-group-item small text-uppercase text-secondary fw-bold bg-body-tertiary">{g}</div>
                                    {list.map((b) => (
                                        <button key={b.key} type="button" className={`list-group-item list-group-item-action ${b.key === key ? 'active' : ''}`} onClick={() => select(b.key)}>
                                            {cap(b.label.includes(':') ? b.label.split(':')[1].trim() : b.label)}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
                <div className="col-lg-9">
                    <Card
                        title={<>{block.label} <code className="small ms-2">{key}</code></>}
                        tools={<button className="btn btn-primary btn-sm" onClick={save}><i className="bi bi-save" /> Save</button>}
                        footer={<span className="small text-secondary">Last saved {formatDate(block.updated_at)}{block.updated_by && ` by ${block.updated_by}`}</span>}
                    >
                        {BLOCK_SCHEMAS[key] ? (
                            <SchemaEditor schema={BLOCK_SCHEMAS[key]} value={value} onChange={(v) => { setValue(v); setDirty(true); }} />
                        ) : <p>No editor for this block.</p>}
                    </Card>
                </div>
            </div>
        </Page>
    );
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
