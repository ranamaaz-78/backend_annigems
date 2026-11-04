import { useRef, useState } from 'react';
import api, { errorMessage } from '../api';

export function Field({ label, error, help, children, className = 'mb-3' }) {
    return (
        <div className={className}>
            {label && <label className="form-label">{label}</label>}
            {children}
            {help && <div className="form-text">{help}</div>}
            {error && <div className="invalid-feedback d-block">{error}</div>}
        </div>
    );
}

export function Input({ label, error, help, className, value, onChange, type = 'text', ...rest }) {
    return (
        <Field label={label} error={error} help={help} className={className}>
            <input
                type={type}
                className={`form-control ${error ? 'is-invalid' : ''}`}
                value={value ?? ''}
                onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                {...rest}
            />
        </Field>
    );
}

/** EUR money input: shows euros, emits minor units (cents). */
export function MoneyInput({ label, error, help, className, value, onChange, nullable, ...rest }) {
    const shown = value === null || value === undefined || value === '' ? '' : (value / 100).toFixed(2);
    const [text, setText] = useState(shown);
    const [focused, setFocused] = useState(false);
    return (
        <Field label={label} error={error} help={help} className={className}>
            <div className="input-group">
                <span className="input-group-text">€</span>
                <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`form-control ${error ? 'is-invalid' : ''}`}
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
            <textarea className={`form-control ${error ? 'is-invalid' : ''}`} rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
        </Field>
    );
}

export function Select({ label, error, help, className, value, onChange, options, placeholder, ...rest }) {
    return (
        <Field label={label} error={error} help={help} className={className}>
            <select className={`form-select ${error ? 'is-invalid' : ''}`} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
                {placeholder !== undefined && <option value="">{placeholder}</option>}
                {options.map((o) => {
                    const opt = typeof o === 'object' ? o : { value: o, label: o };
                    return <option key={opt.value} value={opt.value}>{opt.label}</option>;
                })}
            </select>
        </Field>
    );
}

export function Check({ label, checked, onChange, id, className = 'mb-3', type = 'switch' }) {
    const fid = id || `chk-${label}`.replace(/\W+/g, '-');
    return (
        <div className={`form-check ${type === 'switch' ? 'form-switch' : ''} ${className}`}>
            <input className="form-check-input" type="checkbox" id={fid} checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
            <label className="form-check-label" htmlFor={fid}>{label}</label>
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
            {list.map((item, i) => (
                <div className="input-group mb-1" key={i}>
                    {multiline ? (
                        <textarea className="form-control" rows={2} value={item} onChange={(e) => set(i, e.target.value)} />
                    ) : (
                        <input className="form-control" value={item} onChange={(e) => set(i, e.target.value)} />
                    )}
                    <button type="button" className="btn btn-outline-secondary" onClick={() => move(i, -1)} title="Up"><i className="bi bi-arrow-up" /></button>
                    <button type="button" className="btn btn-outline-secondary" onClick={() => move(i, 1)} title="Down"><i className="bi bi-arrow-down" /></button>
                    <button type="button" className="btn btn-outline-danger" onClick={() => onChange(list.filter((_, j) => j !== i))} title="Remove"><i className="bi bi-x-lg" /></button>
                </div>
            ))}
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onChange([...list, ''])}>
                <i className="bi bi-plus" /> {placeholder}
            </button>
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
            {list.map((item, i) => (
                <div key={i} className="border rounded p-2 mb-2 bg-body-tertiary">
                    <div className="row g-2">
                        {fields.map((f) => (
                            <div key={f.key} className={f.col || 'col-md'}>
                                <label className="form-label small mb-0">{f.label}</label>
                                {f.type === 'textarea' ? (
                                    <textarea className="form-control form-control-sm" rows={2} value={item[f.key] ?? ''} onChange={(e) => set(i, f.key, e.target.value)} />
                                ) : f.type === 'image' ? (
                                    <ImageInput value={item[f.key]} onChange={(v) => set(i, f.key, v)} small />
                                ) : f.type === 'checkbox' ? (
                                    <div><input type="checkbox" className="form-check-input" checked={!!item[f.key]} onChange={(e) => set(i, f.key, e.target.checked)} /></div>
                                ) : (
                                    <input
                                        type={f.type || 'text'}
                                        className="form-control form-control-sm"
                                        value={item[f.key] ?? ''}
                                        onChange={(e) => set(i, f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                                    />
                                )}
                            </div>
                        ))}
                        <div className="col-auto d-flex align-items-end gap-1">
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => move(i, -1)}><i className="bi bi-arrow-up" /></button>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => move(i, 1)}><i className="bi bi-arrow-down" /></button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onChange(list.filter((_, j) => j !== i))}><i className="bi bi-trash" /></button>
                        </div>
                    </div>
                </div>
            ))}
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onChange([...list, { ...newItem }])}>
                <i className="bi bi-plus" /> Add
            </button>
        </Field>
    );
}

/** Upload one image through /media; value is the stored path ("/storage/…" or "/images/…"). */
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
    const body = (
        <div className="d-flex align-items-center gap-2">
            {value && <img src={mediaUrl(value)} alt="" style={{ width: small ? 40 : 72, height: small ? 40 : 72, objectFit: 'cover' }} className="rounded border" />}
            <input type="file" accept="image/*" ref={ref} className="d-none" onChange={(e) => upload(e.target.files[0])} />
            <button type="button" className={`btn btn-outline-secondary ${small ? 'btn-sm' : ''}`} onClick={() => ref.current.click()} disabled={busy}>
                {busy ? 'Uploading…' : <><i className="bi bi-upload" /> {value ? 'Replace' : 'Upload'}</>}
            </button>
            {value && <button type="button" className={`btn btn-outline-danger ${small ? 'btn-sm' : ''}`} onClick={() => onChange(null)}><i className="bi bi-x" /></button>}
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
