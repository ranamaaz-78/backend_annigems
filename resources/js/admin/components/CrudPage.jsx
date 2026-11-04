import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../api';
import DataTable, { FilterBar, SearchInput } from './DataTable';
import { ActiveBadge, Icon, Modal, Page, useFlash } from './ui';
import { Check, ImageInput, Input, MoneyInput, ObjectList, Select, StringList, Textarea } from './form';

/**
 * Generic list + modal form for simple admin resources (Metronic card + kt-table + kt-modal).
 *
 * fields: [{key, label, type: text|textarea|number|money|select|check|image|strings|objects|color|date|datetime|custom, options, col, help, default}]
 * `col`: Tailwind grid span inside the 12-col form grid, e.g. 'md:col-span-6'.
 */
export default function CrudPage({ title, singular, crumbs, url, columns, fields, defaultSort, newItem = {}, filters: extraFilters, renderFilters, canDelete = true, transformOut = (v) => v, modalSize = 'lg', extraActions, beforeTable, headerActions }) {
    const [params, setParams] = useSearchParams();
    const [q, setQ] = useState('');
    const [filters, setFilters] = useState(extraFilters || {});
    const [editing, setEditing] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [reload, setReload] = useState(0);
    const [flash, setFlash] = useFlash();
    const name = singular || title.replace(/s$/, '').toLowerCase();

    const defaults = Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.type === 'check' ? false : f.type === 'strings' || f.type === 'objects' ? [] : '')]));
    const open = (row) => {
        setErrors({});
        setEditing(row ? { ...row } : { ...defaults, ...newItem });
    };

    // Sidebar "Add New" shortcut: ?new=1
    useEffect(() => {
        if (params.get('new')) {
            open(null);
            params.delete('new');
            setParams(params, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params]);

    const save = async (e) => {
        e?.preventDefault();
        setSaving(true);
        setErrors({});
        try {
            const body = transformOut(editing);
            if (editing.id) await api.put(`${url}/${editing.id}`, body);
            else await api.post(url, body);
            setEditing(null);
            setReload((r) => r + 1);
            setFlash(`${name.charAt(0).toUpperCase() + name.slice(1)} saved.`);
        } catch (err) {
            setErrors(fieldErrors(err));
            if (!err.response?.data?.errors) setFlash(errorMessage(err), 'danger');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (row) => {
        if (!window.confirm(`Delete this ${name}?`)) return;
        try {
            await api.delete(`${url}/${row.id}`);
            setReload((r) => r + 1);
            setFlash('Deleted.');
        } catch (err) {
            const fe = fieldErrors(err);
            setFlash(fe[Object.keys(fe)[0]] || errorMessage(err), 'danger');
        }
    };

    const cols = [
        ...columns,
        {
            key: '_actions', label: '', className: 'text-end whitespace-nowrap w-[1%]',
            render: (row) => (
                <div className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {extraActions?.(row, () => setReload((r) => r + 1))}
                    <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" onClick={() => open(row)} title="Edit"><Icon name="notepad-edit" /></button>
                    {canDelete && <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost text-destructive" onClick={() => remove(row)} title="Delete"><Icon name="trash" /></button>}
                </div>
            ),
        },
    ];

    const set = (k, v) => setEditing((s) => ({ ...s, [k]: v }));

    return (
        <Page
            title={title}
            crumbs={crumbs}
            actions={<>{headerActions}<button className="kt-btn kt-btn-primary" onClick={() => open(null)}><Icon name="plus" /> New {name}</button></>}
        >
            {flash}
            {beforeTable}
            <div className="kt-card kt-card-grid min-w-full">
                <div className="kt-card-header flex-wrap gap-2.5 py-3">
                    <h3 className="kt-card-title">All {title.toLowerCase()}</h3>
                    <FilterBar>
                        <SearchInput value={q} onChange={setQ} placeholder={`Search ${title.toLowerCase()}`} />
                        {renderFilters?.(filters, setFilters)}
                    </FilterBar>
                </div>
                <div className="kt-card-table">
                    <DataTable url={url} columns={cols} filters={{ q, ...filters }} defaultSort={defaultSort} reloadKey={reload} onRowClick={(row) => open(row)} empty={`No ${title.toLowerCase()} yet.`} />
                </div>
            </div>

            <Modal
                show={!!editing}
                onClose={() => setEditing(null)}
                title={editing?.id ? `Edit ${name}` : `New ${name}`}
                size={modalSize}
                footer={
                    <>
                        <button className="kt-btn kt-btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                        <button className="kt-btn kt-btn-primary" onClick={save} disabled={saving}>
                            {saving ? <><span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Saving…</> : <><Icon name="check" /> Save</>}
                        </button>
                    </>
                }
            >
                {editing && (
                    <form onSubmit={save} className="grid grid-cols-12 gap-x-5">
                        {fields.filter((f) => !f.hidden?.(editing)).map((f, i) => (
                            <div key={`${f.key}-${i}`} className={`col-span-12 ${f.col || ''}`}>
                                <FieldControl f={f} value={editing[f.key]} onChange={(v) => set(f.key, v)} error={errors[f.key]} item={editing} />
                            </div>
                        ))}
                        <button type="submit" className="hidden" />
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
        case 'check': return <Check label={f.label} description={f.help} checked={value} onChange={onChange} />;
        case 'image': return <ImageInput {...common} folder={f.folder} />;
        case 'strings': return <StringList {...common} multiline={f.multiline} />;
        case 'objects': return <ObjectList label={f.label} value={value} onChange={onChange} fields={f.fields} newItem={f.newItem} help={f.help} />;
        case 'color':
            return (
                <div className="flex flex-col gap-1.5 mb-4">
                    <label className="kt-form-label text-sm font-medium text-mono">{f.label}</label>
                    <div className="flex items-center gap-2">
                        <input type="color" className="size-[34px] shrink-0 rounded-md border border-input cursor-pointer bg-background p-0.5" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
                        <input className="kt-input" aria-invalid={error ? 'true' : undefined} value={value || ''} onChange={(e) => onChange(e.target.value)} />
                    </div>
                    {error && <div className="text-xs text-destructive">{error}</div>}
                </div>
            );
        case 'date': return <Input {...common} type="date" value={value ? String(value).slice(0, 10) : ''} />;
        case 'datetime': return <Input {...common} type="datetime-local" value={value ? String(value).slice(0, 16) : ''} />;
        case 'custom': return f.render({ value, onChange, error, item });
        default: return <Input {...common} />;
    }
}

export { ActiveBadge, FilterBar };
