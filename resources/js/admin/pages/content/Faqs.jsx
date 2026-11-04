import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { ActiveBadge, Card, Modal, Page, Spinner, useFlash } from '../../components/ui';
import { Check, Input, Select, Textarea } from '../../components/form';

export default function Faqs() {
    const [cats, setCats] = useState(null);
    const [edit, setEdit] = useState(null);
    const [errors, setErrors] = useState({});
    const [drag, setDrag] = useState(null); // {catId, index}
    const [flash, setFlash] = useFlash();

    useEffect(() => { api.get('/content/faqs').then(({ data }) => setCats(data.data)); }, []);
    const call = async (fn, msg) => {
        try {
            const { data } = await fn();
            setCats(data.data);
            setEdit(null);
            if (msg) setFlash(msg);
        } catch (e) {
            setErrors(fieldErrors(e));
            setFlash(errorMessage(e), 'danger');
        }
    };

    const drop = (catId, index) => {
        if (!drag) return;
        const next = cats.map((c) => ({ ...c, faqs: [...c.faqs] }));
        const from = next.find((c) => c.id === drag.catId);
        const [item] = from.faqs.splice(drag.index, 1);
        next.find((c) => c.id === catId).faqs.splice(index, 0, item);
        setCats(next);
        setDrag(null);
        call(() => api.post('/content/faqs/reorder', { items: Object.fromEntries(next.map((c) => [c.id, c.faqs.map((f) => f.id)])) }), 'Order saved.');
    };

    const moveCat = (i, d) => {
        const next = [...cats];
        const j = i + d;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        call(() => api.post('/content/faqs/reorder', { categories: next.map((c) => c.id) }), 'Order saved.');
    };

    if (!cats) return <Page title="FAQs"><Spinner /></Page>;
    const b = (k) => ({ value: edit?.[k], onChange: (v) => setEdit({ ...edit, [k]: v }), error: errors[k] });

    return (
        <Page title="FAQs" crumbs={[{ label: 'Content' }, { label: 'FAQs' }]}
            actions={<>
                <button className="btn btn-sm btn-outline-primary" onClick={() => { setErrors({}); setEdit({ _type: 'cat', name: '' }); }}><i className="bi bi-folder-plus" /> New category</button>
                <button className="btn btn-sm btn-primary" disabled={!cats.length} onClick={() => { setErrors({}); setEdit({ _type: 'faq', category_id: cats[0].id, question: '', answer: '', is_active: true }); }}><i className="bi bi-plus" /> New question</button>
            </>}>
            {flash}
            <p className="small text-secondary">Drag questions to reorder them or move them to another category.</p>
            {cats.map((c, ci) => (
                <Card key={c.id} title={c.name} noBody
                    tools={<div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-secondary" onClick={() => moveCat(ci, -1)}><i className="bi bi-arrow-up" /></button>
                        <button className="btn btn-outline-secondary" onClick={() => moveCat(ci, 1)}><i className="bi bi-arrow-down" /></button>
                        <button className="btn btn-outline-primary" onClick={() => { setErrors({}); setEdit({ _type: 'cat', id: c.id, name: c.name }); }}><i className="bi bi-pencil" /></button>
                        <button className="btn btn-outline-danger" onClick={() => window.confirm('Delete this category and its questions?') && call(() => api.delete(`/content/faq-categories/${c.id}`), 'Deleted.')}><i className="bi bi-trash" /></button>
                    </div>}>
                    <ul className="list-group list-group-flush" onDragOver={(e) => e.preventDefault()} onDrop={() => drop(c.id, c.faqs.length)}>
                        {c.faqs.map((f, i) => (
                            <li key={f.id} className={`list-group-item drag-item ${drag?.catId === c.id && drag.index === i ? 'dragging' : ''}`} draggable
                                onDragStart={() => setDrag({ catId: c.id, index: i })} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); drop(c.id, i); }}>
                                <div className="d-flex justify-content-between gap-2">
                                    <div><i className="bi bi-grip-vertical text-secondary me-2" /><strong>{f.question}</strong> {!f.is_active && <ActiveBadge active={false} />}<div className="small text-secondary ms-4">{f.answer}</div></div>
                                    <div className="btn-group btn-group-sm align-self-start">
                                        <button className="btn btn-outline-primary" onClick={() => { setErrors({}); setEdit({ _type: 'faq', ...f }); }}><i className="bi bi-pencil" /></button>
                                        <button className="btn btn-outline-danger" onClick={() => window.confirm('Delete this question?') && call(() => api.delete(`/content/faqs/${f.id}`), 'Deleted.')}><i className="bi bi-trash" /></button>
                                    </div>
                                </div>
                            </li>
                        ))}
                        {!c.faqs.length && <li className="list-group-item text-secondary small">Drop questions here.</li>}
                    </ul>
                </Card>
            ))}
            <Modal show={!!edit} onClose={() => setEdit(null)} title={edit?._type === 'cat' ? 'FAQ category' : 'Question'}
                footer={<button className="btn btn-primary" onClick={() => {
                    if (edit._type === 'cat') return call(() => (edit.id ? api.put(`/content/faq-categories/${edit.id}`, edit) : api.post('/content/faq-categories', edit)), 'Saved.');
                    return call(() => (edit.id ? api.put(`/content/faqs/${edit.id}`, edit) : api.post('/content/faqs', edit)), 'Saved.');
                }}>Save</button>}>
                {edit?._type === 'cat' ? <Input label="Name" {...b('name')} /> : edit && (
                    <>
                        <Select label="Category" {...b('category_id')} options={cats.map((c) => ({ value: c.id, label: c.name }))} />
                        <Input label="Question" {...b('question')} />
                        <Textarea label="Answer" rows={5} {...b('answer')} />
                        <Check label="Active" checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} id="faq-active" />
                    </>
                )}
            </Modal>
        </Page>
    );
}
