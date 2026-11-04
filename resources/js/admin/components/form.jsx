import { useId, useRef, useState } from 'react';
import api, { errorMessage } from '../api';
import { Icon } from './ui';

export function Field({ label, error, help, children, className = 'mb-4' }) {
    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && <label className="kt-form-label text-sm font-medium text-mono">{label}</label>}
            {children}
            {help && <div className="text-xs text-muted-foreground">{help}</div>}
            {error && <div className="text-xs text-destructive">{error}</div>}
        </div>
    );
}

export function Input({ label, error, help, className, value, onChange, type = 'text', icon, ...rest }) {
    const input = (
        <input
            type={type}
            className={icon ? '' : 'kt-input'}
            aria-invalid={error ? 'true' : undefined}
            value={value ?? ''}
            onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
            {...rest}
        />
    );
    return (
        <Field label={label} error={error} help={help} className={className}>
            {icon ? <div className="kt-input" aria-invalid={error ? 'true' : undefined}><Icon name={icon} />{input}</div> : input}
        </Field>
    );
}

/** EUR money input: shows euros, emits minor units (cents). */
export function MoneyInput({ label, error, help, className, value, onChange, nullable, currency = '€', ...rest }) {
    const shown = value === null || value === undefined || value === '' ? '' : (value / 100).toFixed(2);
    const [text, setText] = useState(shown);
    const [focused, setFocused] = useState(false);
    return (
        <Field label={label} error={error} help={help} className={className}>
            <div className="kt-input-group">
                <span className="kt-input-addon">{currency}</span>
                <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="kt-input"
                    aria-invalid={error ? 'true' : undefined}
                    value={focused ? text : shown}
                    onFocus={() => { setText(shown); setFocused(true); }}
                    onBlur={() => setFocused(false)}
                    onChange={(e) => {
                        setText(e.target.value);
                        if (e.target.value === '') onChange(nullable ? null : 0);
                        else onChange(Math.round(parseFloat(e.target.value) * 100));
                    }}
                    {...rest}
                />
            </div>
        </Field>
    );
}

export function Textarea({ label, error, help, className, value, onChange, rows = 3, ...rest }) {
    return (
        <Field label={label} error={error} help={help} className={className}>
            <textarea className="kt-textarea" aria-invalid={error ? 'true' : undefined} rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
        </Field>
    );
}

export function Select({ label, error, help, className, value, onChange, options, placeholder, ...rest }) {
    return (
        <Field label={label} error={error} help={help} className={className}>
            <select className="kt-select" aria-invalid={error ? 'true' : undefined} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
                {placeholder !== undefined && <option value="">{placeholder}</option>}
                {options.map((o) => {
                    const opt = typeof o === 'object' ? o : { value: o, label: o };
                    return <option key={opt.value} value={opt.value}>{opt.label}</option>;
                })}
            </select>
        </Field>
    );
}

/** Switch (default) or checkbox. */
export function Check({ label, checked, onChange, id, className = 'mb-4', type = 'switch', description }) {
    const auto = useId();
    const fid = id || auto;
    return (
        <div className={`flex items-start gap-2.5 ${className}`}>
            <input
                type="checkbox"
                id={fid}
                className={type === 'switch' ? 'kt-switch mt-0.5' : 'kt-checkbox mt-0.5'}
                checked={!!checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <label htmlFor={fid} className="flex flex-col gap-0.5 cursor-pointer">
                <span className="text-sm text-mono">{label}</span>
                {description && <span className="text-xs text-secondary-foreground">{description}</span>}
            </label>
        </div>
    );
}

function MoveButtons({ onUp, onDown, onRemove }) {
    return (
        <div className="flex gap-1 shrink-0">
            <button type="button" className="kt-btn kt-btn-icon kt-btn-sm kt-btn-ghost" onClick={onUp} title="Move up"><Icon name="up" /></button>
            <button type="button" className="kt-btn kt-btn-icon kt-btn-sm kt-btn-ghost" onClick={onDown} title="Move down"><Icon name="down" /></button>
            <button type="button" className="kt-btn kt-btn-icon kt-btn-sm kt-btn-ghost text-destructive" onClick={onRemove} title="Remove"><Icon name="trash" /></button>
        </div>
    );
}

/** Editable list of strings (details, tags, paragraphs…). */
export function StringList({ label, value = [], onChange, error, multiline, placeholder = 'Add item', help }) {
    const list = value || [];
    const set = (i, v) => onChange(list.map((x, j) => (j === i ? v : x)));
    const move = (i, d) => {
        const n = [...list];
        const j = i + d;
        if (j < 0 || j >= n.length) return;
        [n[i], n[j]] = [n[j], n[i]];
        onChange(n);
    };
    return (
        <Field label={label} error={error} help={help}>
            <div className="flex flex-col gap-2">
                {list.map((item, i) => (
                    <div className="flex items-start gap-2" key={i}>
                        {multiline ? (
                            <textarea className="kt-textarea" rows={2} value={item} onChange={(e) => set(i, e.target.value)} />
                        ) : (
                            <input className="kt-input" value={item} onChange={(e) => set(i, e.target.value)} />
                        )}
                        <MoveButtons onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => onChange(list.filter((_, j) => j !== i))} />
                    </div>
                ))}
                <div>
                    <button type="button" className="kt-btn kt-btn-sm kt-btn-outline" onClick={() => onChange([...list, ''])}>
                        <Icon name="plus" /> {placeholder}
                    </button>
                </div>
            </div>
        </Field>
    );
}

/**
 * Editable list of objects with a fixed set of fields.
 * fields: [{key, label, type?: 'text'|'textarea'|'number'|'image'|'checkbox', col?}]
 */
export function ObjectList({ label, value = [], onChange, fields, newItem = {}, help }) {
    const list = value || [];
    const set = (i, key, v) => onChange(list.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
    const move = (i, d) => {
        const n = [...list];
        const j = i + d;
        if (j < 0 || j >= n.length) return;
        [n[i], n[j]] = [n[j], n[i]];
        onChange(n);
    };
    return (
        <Field label={label} help={help}>
            <div className="flex flex-col gap-2.5">
                {list.map((item, i) => (
                    <div key={i} className="flex items-end gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
                        <div className="grid grow gap-2.5 md:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
                            {fields.map((f) => (
                                <div key={f.key} className="flex flex-col gap-1">
                                    <label className="text-xs text-secondary-foreground">{f.label}</label>
                                    {f.type === 'textarea' ? (
                                        <textarea className="kt-textarea kt-textarea-sm" rows={2} value={item[f.key] ?? ''} onChange={(e) => set(i, f.key, e.target.value)} />
                                    ) : f.type === 'image' ? (
                                        <ImageInput value={item[f.key]} onChange={(v) => set(i, f.key, v)} small />
                                    ) : f.type === 'checkbox' ? (
                                        <input type="checkbox" className="kt-checkbox" checked={!!item[f.key]} onChange={(e) => set(i, f.key, e.target.checked)} />
                                    ) : (
                                        <input
                                            type={f.type || 'text'}
                                            className="kt-input kt-input-sm"
                                            value={item[f.key] ?? ''}
                                            onChange={(e) => set(i, f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <MoveButtons onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => onChange(list.filter((_, j) => j !== i))} />
                    </div>
                ))}
                <div>
                    <button type="button" className="kt-btn kt-btn-sm kt-btn-outline" onClick={() => onChange([...list, { ...newItem }])}>
                        <Icon name="plus" /> Add
                    </button>
                </div>
            </div>
        </Field>
    );
}

/** Upload one image through /media; value is the stored public-disk path. */
export function ImageInput({ label, value, onChange, error, small, folder = 'uploads' }) {
    const ref = useRef();
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const upload = async (file) => {
        if (!file) return;
        setBusy(true);
        setErr(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('folder', folder);
            const { data } = await api.post('/media', fd);
            onChange(data.data.path);
        } catch (e) {
            setErr(errorMessage(e, 'Upload failed.'));
        } finally {
            setBusy(false);
        }
    };
    const size = small ? 'size-10' : 'size-20';
    const body = (
        <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => ref.current.click()} className={`relative ${size} shrink-0 rounded-lg border border-dashed border-input bg-muted/50 overflow-hidden flex items-center justify-center hover:border-primary transition-colors`} title="Upload image">
                {value ? <img src={mediaUrl(value)} alt="" className="size-full object-cover" /> : <Icon name={busy ? 'loading' : 'picture'} className={`text-muted-foreground ${busy ? 'animate-spin' : ''} ${small ? 'text-base' : 'text-2xl'}`} />}
            </button>
            <input type="file" accept="image/*" ref={ref} className="hidden" onChange={(e) => upload(e.target.files[0])} />
            {!small && (
                <div className="flex gap-1.5">
                    <button type="button" className="kt-btn kt-btn-sm kt-btn-outline" onClick={() => ref.current.click()} disabled={busy}>
                        <Icon name="cloud-add" /> {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
                    </button>
                    {value && <button type="button" className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost text-destructive" onClick={() => onChange(null)} title="Remove"><Icon name="trash" /></button>}
                </div>
            )}
            {small && value && <button type="button" className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost text-destructive" onClick={() => onChange(null)} title="Remove"><Icon name="cross" /></button>}
        </div>
    );
    if (small) return body;
    return <Field label={label} error={error || err}>{body}</Field>;
}

/** Image paths in the DB are relative to the public disk ("images/x.jpg") or absolute URLs. */
export function mediaUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//.test(path)) return path;
    if (path.startsWith('/storage/')) return path;
    return `/storage/${path.replace(/^\//, '')}`;
}

/** Hook for simple forms: values, setter, errors. */
export function useForm(initial) {
    const [values, setValues] = useState(initial);
    const [errors, setErrors] = useState({});
    const bind = (key) => ({ value: values?.[key], onChange: (v) => setValues((s) => ({ ...s, [key]: v })), error: errors[key] });
    return { values, setValues, errors, setErrors, bind, set: (key, v) => setValues((s) => ({ ...s, [key]: v })) };
}
