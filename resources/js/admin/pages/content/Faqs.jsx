import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { ActiveBadge, Icon, Modal, Page, Spinner, useFlash } from '../../components/ui';
import { Check, Input, Select, Textarea } from '../../components/form';

export default function Faqs() {
    const [cats, setCats] = useState(null);
    const [edit, setEdit] = useState(null);
    const [errors, setErrors] = useState({});
    const [drag, setDrag] = useState(null); // {catId, index}
    const [overCat, setOverCat] = useState(null);
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
        setOverCat(null);
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

    if (!cats) return <Page title="FAQs" crumbs={[{ label: 'Content' }]}><Spinner /></Page>;
    const b = (k) => ({ value: edit?.[k], onChange: (v) => setEdit({ ...edit, [k]: v }), error: errors[k] });

    return (
        <Page title="FAQs" crumbs={[{ label: 'Content' }, { label: 'FAQs' }]}
            actions={<>
                <button className="kt-btn kt-btn-outline" onClick={() => { setErrors({}); setEdit({ _type: 'cat', name: '' }); }}><Icon name="add-folder" /> New category</button>
                <button className="kt-btn kt-btn-primary" disabled={!cats.length} onClick={() => { setErrors({}); setEdit({ _type: 'faq', category_id: cats[0].id, question: '', answer: '', is_active: true }); }}><Icon name="plus" /> New question</button>
            </>}>
            {flash}
            <div className="text-sm text-secondary-foreground -mt-2 flex items-center gap-1.5"><Icon name="information-2" /> Drag questions to reorder them or move them to another category.</div>
            <div className="grid lg:grid-cols-2 gap-5 lg:gap-7.5 items-start">
                {cats.map((c, ci) => (
                    <div key={c.id} className={`kt-card transition-shadow ${overCat === c.id ? 'ring-2 ring-primary/30' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setOverCat(c.id); }} onDragLeave={() => setOverCat(null)} onDrop={() => drop(c.id, c.faqs.length)}>
                        <div className="kt-card-header">
                            <h3 className="kt-card-title flex items-center gap-2"><Icon name="questionnaire-tablet" className="text-muted-foreground" />{c.name} <span className="kt-badge kt-badge-sm kt-badge-outline">{c.faqs.length}</span></h3>
                            <div className="flex gap-0.5">
                                <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" onClick={() => moveCat(ci, -1)} title="Move up"><Icon name="up" /></button>
                                <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" onClick={() => moveCat(ci, 1)} title="Move down"><Icon name="down" /></button>
                                <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" onClick={() => { setErrors({}); setEdit({ _type: 'cat', id: c.id, name: c.name }); }} title="Rename"><Icon name="notepad-edit" /></button>
                                <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost text-destructive" onClick={() => window.confirm('Delete this category and its questions?') && call(() => api.delete(`/content/faq-categories/${c.id}`), 'Deleted.')} title="Delete"><Icon name="trash" /></button>
                            </div>
                        </div>
                        <div className="kt-card-content p-2.5 flex flex-col gap-1.5">
                            {c.faqs.map((f, i) => (
                                <div key={f.id} className={`group flex items-start gap-2.5 rounded-lg border border-border bg-background p-3 drag-item ${drag?.catId === c.id && drag.index === i ? 'dragging' : ''}`} draggable
                                    onDragStart={() => setDrag({ catId: c.id, index: i })} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); drop(c.id, i); }}>
                                    <Icon name="menu" className="text-muted-foreground mt-0.5 cursor-grab" />
                                    <div className="grow min-w-0">
                                        <div className="text-sm font-medium text-mono flex items-center gap-2">{f.question} {!f.is_active && <ActiveBadge active={false} />}</div>
                                        <div className="text-xs text-secondary-foreground mt-1 line-clamp-2">{f.answer}</div>
                                    </div>
                                    <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" onClick={() => { setErrors({}); setEdit({ _type: 'faq', ...f }); }}><Icon name="notepad-edit" /></button>
                                        <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost text-destructive" onClick={() => window.confirm('Delete this question?') && call(() => api.delete(`/content/faqs/${f.id}`), 'Deleted.')}><Icon name="trash" /></button>
                                    </div>
                                </div>
                            ))}
                            {!c.faqs.length && <div className="rounded-lg border-2 border-dashed border-input p-5 text-center text-sm text-secondary-foreground">Drop questions here.</div>}
                        </div>
                    </div>
                ))}
            </div>
            <Modal show={!!edit} onClose={() => setEdit(null)} title={edit?._type === 'cat' ? (edit?.id ? 'Rename category' : 'New category') : edit?.id ? 'Edit question' : 'New question'}
                footer={<><button className="kt-btn kt-btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="kt-btn kt-btn-primary" onClick={() => {
                    if (edit._type === 'cat') return call(() => (edit.id ? api.put(`/content/faq-categories/${edit.id}`, edit) : api.post('/content/faq-categories', edit)), 'Saved.');
                    return call(() => (edit.id ? api.put(`/content/faqs/${edit.id}`, edit) : api.post('/content/faqs', edit)), 'Saved.');
                }}><Icon name="check" /> Save</button></>}>
                {edit?._type === 'cat' ? <Input label="Name" {...b('name')} /> : edit && (
                    <>
                        <Select label="Category" {...b('category_id')} options={cats.map((c) => ({ value: c.id, label: c.name }))} />
                        <Input label="Question" {...b('question')} />
                        <Textarea label="Answer" rows={5} {...b('answer')} />
                        <Check label="Active" checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} />
                    </>
                )}
            </Modal>
        </Page>
    );
}
