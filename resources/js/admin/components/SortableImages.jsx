import { useRef, useState } from 'react';
import api, { errorMessage } from '../api';
import { mediaUrl } from './form';

/** Multi-image uploader with HTML5 drag-and-drop reordering. value: [{path, alt}] */
export default function SortableImages({ value = [], onChange, folder = 'products' }) {
    const input = useRef();
    const [drag, setDrag] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const upload = async (files) => {
        setBusy(true);
        setError(null);
        const added = [];
        try {
            for (const file of files) {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', folder);
                const { data } = await api.post('/media', fd);
                added.push({ path: data.data.path, alt: '' });
            }
            onChange([...value, ...added]);
        } catch (e) {
            setError(errorMessage(e, 'Upload failed.'));
            if (added.length) onChange([...value, ...added]);
        } finally {
            setBusy(false);
            input.current.value = '';
        }
    };

    const drop = (to) => {
        if (drag === null || drag === to) return;
        const next = [...value];
        const [moved] = next.splice(drag, 1);
        next.splice(to, 0, moved);
        onChange(next);
        setDrag(null);
    };

    return (
        <div>
            <div className="d-flex flex-wrap gap-2 mb-2">
                {value.map((img, i) => (
                    <div
                        key={`${img.path}-${i}`}
                        className={`position-relative border rounded p-1 drag-item ${drag === i ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => setDrag(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => drop(i)}
                        onDragEnd={() => setDrag(null)}
                        style={{ width: 120 }}
                    >
                        <img src={mediaUrl(img.path)} alt="" style={{ width: '100%', height: 100, objectFit: 'cover' }} className="rounded" />
                        {i === 0 && <span className="badge text-bg-primary position-absolute top-0 start-0 m-1">Main</span>}
                        <button type="button" className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 py-0 px-1" onClick={() => onChange(value.filter((_, j) => j !== i))}><i className="bi bi-x" /></button>
                        <input className="form-control form-control-sm mt-1" placeholder="Alt text" value={img.alt || ''} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
                    </div>
                ))}
            </div>
            <input type="file" accept="image/*" multiple className="d-none" ref={input} onChange={(e) => upload([...e.target.files])} />
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => input.current.click()} disabled={busy}>
                <i className="bi bi-upload" /> {busy ? 'Uploading…' : 'Upload images'}
            </button>
            <span className="small text-secondary ms-2">Drag to reorder. The first image is the main image.</span>
            {error && <div className="text-danger small mt-1">{error}</div>}
        </div>
    );
}
