import { useState } from 'react';
import api, { errorMessage, fieldErrors } from '../api';
import DataTable, { FilterBar } from './DataTable';
import { ActiveBadge, Card, Modal, Page, useFlash } from './ui';
import { Check, ImageInput, Input, MoneyInput, Select, StringList, Textarea, ObjectList } from './form';

/**
 * Generic list + modal form for simple admin resources.
 *
 * fields: [{key, label, type: text|textarea|number|money|select|check|image|strings|objects|color|date|datetime, options, col, help, default}]
 */
export default function CrudPage({ title, crumbs, url, columns, fields, defaultSort, newItem = {}, filters: extraFilters, renderFilters, canDelete = true, transformOut = (v) => v, modalSize = 'lg', extraActions, beforeTable }) {
    const [q, setQ] = useState('');
    const [filters, setFilters] = useState(extraFilters || {});
    const [editing, setEditing] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [reload, setReload] = useState(0);
    const [flash, setFlash] = useFlash();

    const defaults = Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.type === 'check' ? false : f.type === 'strings' || f.type === 'objects' ? [] : '')]));
    const open = (row) => {
        setErrors({});
        setEditing(row ? { ...row } : { ...defaults, ...newItem });
    };

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});
        try {
            const body = transformOut(editing);
            if (editing.id) await api.put(`${url}/${editing.id}`, body);
            else await api.post(url, body);
            setEditing(null);
            setReload((r) => r + 1);
            setFlash('Saved.');
        } catch (err) {
            setErrors(fieldErrors(err));
            if (!err.response?.data?.errors) setFlash(errorMessage(err), 'danger');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (row) => {
        if (!window.confirm('Delete this record?')) return;
        try {
            await api.delete(`${url}/${row.id}`);
            setReload((r) => r + 1);
            setFlash('Deleted.');
        } catch (err) {
            setFlash(fieldErrors(err)[Object.keys(fieldErrors(err))[0]] || errorMessage(err), 'danger');
        }
    };

    const cols = [
        ...columns,
        {
            key: '_actions', label: '', className: 'text-end text-nowrap',
            render: (row) => (
                <div className="btn-group btn-group-sm">
                    {extraActions?.(row, () => setReload((r) => r + 1))}
                    <button className="btn btn-outline-primary" onClick={() => open(row)} title="Edit"><i className="bi bi-pencil" /></button>
                    {canDelete && <button className="btn btn-outline-danger" onClick={() => remove(row)} title="Delete"><i className="bi bi-trash" /></button>}
                </div>
            ),
        },
    ];

    const set = (k, v) => setEditing((s) => ({ ...s, [k]: v }));

    return (
        <Page title={title} crumbs={crumbs}>
            {flash}
            {beforeTable}
            <Card
                noBody
                title={
                    <div className="d-flex gap-2 align-items-center">
                        <input className="form-control form-control-sm" style={{ width: 220 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
                        {renderFilters?.(filters, setFilters)}
                    </div>
                }
                tools={<button className="btn btn-primary btn-sm" onClick={() => open(null)}><i className="bi bi-plus-lg" /> New</button>}
            >
                <DataTable url={url} columns={cols} filters={{ q, ...filters }} defaultSort={defaultSort} reloadKey={reload} />
            </Card>

            <Modal
                show={!!editing}
                onClose={() => setEditing(null)}
                title={editing?.id ? `Edit ${title.replace(/s$/, '').toLowerCase()}` : `New ${title.replace(/s$/, '').toLowerCase()}`}
                size={modalSize}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                    </>
                }
            >
                {editing && (
                    <form onSubmit={save} className="row">
                        {fields.filter((f) => !f.hidden?.(editing)).map((f) => (
                            <div key={f.key} className={f.col || 'col-12'}>
                                <FieldControl f={f} value={editing[f.key]} onChange={(v) => set(f.key, v)} error={errors[f.key]} item={editing} />
                            </div>
                        ))}
                        <button type="submit" className="d-none" />
                    </form>
                )}
            </Modal>
        </Page>
    );
}

export function FieldControl({ f, value, onChange, error, item }) {
    const common = { label: f.label, value, onChange, error, help: f.help };
    switch (f.type) {
        case 'textarea': return <Textarea {...common} rows={f.rows || 3} />;
        case 'number': return <Input {...common} type="number" step={f.step || 'any'} />;
        case 'money': return <MoneyInput {...common} nullable={f.nullable} />;
        case 'select': return <Select {...common} options={typeof f.options === 'function' ? f.options(item) : f.options} placeholder={f.placeholder} />;
        case 'check': return <Check label={f.label} checked={value} onChange={onChange} id={`f-${f.key}`} />;
        case 'image': return <ImageInput {...common} folder={f.folder} />;
        case 'strings': return <StringList {...common} multiline={f.multiline} />;
        case 'objects': return <ObjectList label={f.label} value={value} onChange={onChange} fields={f.fields} newItem={f.newItem} help={f.help} />;
        case 'color':
            return (
                <div className="mb-3">
                    <label className="form-label">{f.label}</label>
                    <div className="input-group">
                        <input type="color" className="form-control form-control-color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
                        <input className={`form-control ${error ? 'is-invalid' : ''}`} value={value || ''} onChange={(e) => onChange(e.target.value)} />
                    </div>
                    {error && <div className="invalid-feedback d-block">{error}</div>}
                </div>
            );
        case 'date': return <Input {...common} type="date" value={value ? String(value).slice(0, 10) : ''} />;
        case 'datetime': return <Input {...common} type="datetime-local" value={value ? String(value).slice(0, 16) : ''} />;
        case 'custom': return f.render({ value, onChange, error, item });
        default: return <Input {...common} />;
    }
}

export { ActiveBadge, FilterBar };
