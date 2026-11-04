import { useRef, useState } from 'react';
import api, { errorMessage } from '../api';
import { mediaUrl } from './form';
import { Icon } from './ui';

/** Multi-image uploader with HTML5 drag-and-drop reordering (Metronic dropzone look). value: [{path, alt}] */
export default function SortableImages({ value = [], onChange, folder = 'products' }) {
    const input = useRef();
    const [drag, setDrag] = useState(null);
    const [over, setOver] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const upload = async (files) => {
        if (!files.length) return;
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
            if (input.current) input.current.value = '';
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
        <div className="flex flex-col gap-4">
            {value.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {value.map((img, i) => (
                        <div
                            key={`${img.path}-${i}`}
                            className={`group relative flex flex-col gap-1.5 rounded-lg border border-border bg-background p-1.5 drag-item ${drag === i ? 'dragging' : ''}`}
                            draggable
                            onDragStart={() => setDrag(i)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.stopPropagation(); drop(i); }}
                            onDragEnd={() => setDrag(null)}
                        >
                            <img src={mediaUrl(img.path)} alt="" className="aspect-square w-full object-cover rounded-md" />
                            {i === 0 && <span className="kt-badge kt-badge-sm kt-badge-primary absolute top-3 start-3">Main</span>}
                            <button type="button" className="kt-btn kt-btn-sm kt-btn-icon kt-btn-destructive absolute top-3 end-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onChange(value.filter((_, j) => j !== i))} title="Remove"><Icon name="trash" /></button>
                            <span className="absolute top-3 start-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity kt-badge kt-badge-sm kt-badge-secondary"><Icon name="arrows-circle" /> drag</span>
                            <input className="kt-input kt-input-sm" placeholder="Alt text" value={img.alt || ''} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
                        </div>
                    ))}
                </div>
            )}
            <input type="file" accept="image/*" multiple className="hidden" ref={input} onChange={(e) => upload([...e.target.files])} />
            <button
                type="button"
                onClick={() => input.current.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) upload([...e.dataTransfer.files]); }}
                className={`flex items-center gap-4 rounded-xl border-2 border-dashed px-5 py-6 text-start transition-colors ${over ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/60 bg-muted/30'}`}
                disabled={busy}
            >
                <span className="flex items-center justify-center size-11 rounded-full bg-primary/10 border border-primary/20 shrink-0">
                    <Icon name={busy ? 'loading' : 'cloud-add'} className={`text-xl text-primary ${busy ? 'animate-spin' : ''}`} />
                </span>
                <span className="flex flex-col">
                    <span className="text-sm font-medium text-mono">{busy ? 'Uploading…' : 'Drop images here or click to upload'}</span>
                    <span className="text-xs text-secondary-foreground">JPG, PNG or WEBP up to 8 MB. Drag thumbnails to reorder; the first is the main image.</span>
                </span>
            </button>
            {error && <div className="text-xs text-destructive">{error}</div>}
        </div>
    );
}
