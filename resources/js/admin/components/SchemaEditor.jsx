import { Check, ImageInput, MoneyInput } from './form';

/**
 * Recursive structured editor.
 * Schema nodes: 'text' | 'textarea' | 'number' | 'image' | 'money' | 'check'
 *   | { type: 'object', fields: [{ key, label, schema }] }
 *   | { type: 'list', of: schema, label?: string, newItem?: any, summary?: (item) => string }
 */
export default function SchemaEditor({ schema, value, onChange, depth = 0 }) {
    const type = typeof schema === 'string' ? schema : schema.type;

    if (type === 'object') {
        const v = value || {};
        return (
            <div className={depth ? 'row g-2' : 'row'}>
                {schema.fields.map((f) => {
                    const childType = typeof f.schema === 'string' ? f.schema : f.schema.type;
                    const wide = ['object', 'list', 'textarea'].includes(childType);
                    return (
                        <div key={f.key} className={f.col || (wide ? 'col-12' : 'col-md-6')}>
                            <label className={`form-label ${depth ? 'small mb-0' : ''}`}>{f.label}</label>
                            <div className={childType === 'object' ? 'border rounded p-2 mb-3 bg-body-tertiary' : 'mb-3'}>
                                <SchemaEditor schema={f.schema} value={v[f.key]} onChange={(x) => onChange({ ...v, [f.key]: x })} depth={depth + 1} />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (type === 'list') {
        const list = Array.isArray(value) ? value : [];
        const itemType = typeof schema.of === 'string' ? schema.of : schema.of.type;
        const blank = schema.newItem !== undefined ? schema.newItem : itemType === 'object' ? {} : itemType === 'number' ? 0 : '';
        const move = (i, d) => {
            const n = [...list];
            const j = i + d;
            if (j < 0 || j >= n.length) return;
            [n[i], n[j]] = [n[j], n[i]];
            onChange(n);
        };
        return (
            <div>
                {list.map((item, i) => (
                    <div key={i} className={`d-flex gap-2 align-items-start ${itemType === 'object' ? 'border rounded p-2 mb-2' : 'mb-1'}`}>
                        <div className="flex-grow-1">
                            <SchemaEditor schema={schema.of} value={item} onChange={(x) => onChange(list.map((y, j) => (j === i ? x : y)))} depth={depth + 1} />
                        </div>
                        <div className="btn-group-vertical btn-group-sm">
                            <button type="button" className="btn btn-outline-secondary" onClick={() => move(i, -1)} title="Up"><i className="bi bi-arrow-up" /></button>
                            <button type="button" className="btn btn-outline-secondary" onClick={() => move(i, 1)} title="Down"><i className="bi bi-arrow-down" /></button>
                            <button type="button" className="btn btn-outline-danger" onClick={() => onChange(list.filter((_, j) => j !== i))} title="Remove"><i className="bi bi-x-lg" /></button>
                        </div>
                    </div>
                ))}
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onChange([...list, structuredClone(blank)])}>
                    <i className="bi bi-plus" /> Add {schema.label || 'item'}
                </button>
            </div>
        );
    }

    if (type === 'image') return <ImageInput value={value} onChange={onChange} small={depth > 1} folder="content" />;
    if (type === 'money') return <MoneyInput value={value} onChange={onChange} className="mb-0" />;
    if (type === 'check') return <Check label="Yes" checked={value} onChange={onChange} className="mb-0" id={`chk-${Math.random()}`} />;
    if (type === 'textarea') return <textarea className="form-control form-control-sm" rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    if (type === 'number') return <input type="number" className="form-control form-control-sm" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    return <input className="form-control form-control-sm" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

const link = { type: 'object', fields: [{ key: 'label', label: 'Label', schema: 'text' }, { key: 'to', label: 'Link', schema: 'text' }] };
const cta = link;
const strings = (label) => ({ type: 'list', of: 'text', label });

/** Structured schema for every content block key. */
export const BLOCK_SCHEMAS = {
    brand: { type: 'object', fields: [
        { key: 'name', label: 'Name', schema: 'text' }, { key: 'since', label: 'Since (year)', schema: 'number' },
        { key: 'logo', label: 'Logo', schema: 'image' }, { key: 'tagline', label: 'Tagline lines', schema: strings('line') },
    ] },
    'home.hero': { type: 'object', fields: [
        { key: 'eyebrow', label: 'Eyebrow ({since} is replaced by the brand year)', schema: 'text', col: 'col-12' },
        { key: 'titleLine1', label: 'Title line 1', schema: 'text' }, { key: 'titleLine2', label: 'Title line 2', schema: 'text' },
        { key: 'text', label: 'Text', schema: 'textarea' }, { key: 'image', label: 'Image', schema: 'image' },
        { key: 'primaryCta', label: 'Button', schema: cta },
    ] },
    'home.usp_items': { type: 'list', label: 'USP', of: { type: 'object', fields: [{ key: 'icon', label: 'Icon', schema: 'text', col: 'col-md-2' }, { key: 'label', label: 'Label', schema: 'text', col: 'col-md-10' }] } },
    'home.category_section': { type: 'object', fields: [{ key: 'title', label: 'Title', schema: 'text' }, { key: 'subtitle', label: 'Subtitle', schema: 'text' }] },
    'home.design_ring_banner': { type: 'object', fields: [
        { key: 'tag', label: 'Tag', schema: 'text', col: 'col-12' }, { key: 'titleLine1', label: 'Title line 1', schema: 'text' }, { key: 'titleLine2', label: 'Title line 2', schema: 'text' },
        { key: 'text', label: 'Text', schema: 'textarea' }, { key: 'cta', label: 'Button', schema: cta },
    ] },
    'home.testimonials_section': { type: 'object', fields: [{ key: 'eyebrow', label: 'Eyebrow', schema: 'text' }, { key: 'title', label: 'Title', schema: 'text' }] },
    'navigation.mega_menu': { type: 'object', fields: [
        { key: 'columns', label: 'Columns', schema: { type: 'list', label: 'column', of: { type: 'object', fields: [{ key: 'heading', label: 'Heading', schema: 'text', col: 'col-12' }, { key: 'links', label: 'Links', schema: { type: 'list', label: 'link', of: link } }] } } },
        { key: 'featured', label: 'Featured card', schema: { type: 'object', fields: [{ key: 'tag', label: 'Tag', schema: 'text' }, { key: 'name', label: 'Name', schema: 'text' }, { key: 'to', label: 'Link', schema: 'text' }, { key: 'image', label: 'Image', schema: 'image' }] } },
    ] },
    'navigation.mobile': { type: 'list', label: 'link', of: { type: 'object', fields: [{ key: 'label', label: 'Label', schema: 'text', col: 'col-md-5' }, { key: 'to', label: 'Link', schema: 'text', col: 'col-md-5' }, { key: 'highlight', label: 'Highlight', schema: 'check', col: 'col-md-2' }] } },
    'footer.columns': { type: 'list', label: 'column', of: { type: 'object', fields: [{ key: 'heading', label: 'Heading', schema: 'text', col: 'col-12' }, { key: 'links', label: 'Links', schema: { type: 'list', label: 'link', of: link } }] } },
    'footer.legal_links': { type: 'list', label: 'link', of: link },
    contact: { type: 'object', fields: [
        { key: 'address', label: 'Address', schema: 'text', col: 'col-12' }, { key: 'phone', label: 'Phone', schema: 'text' }, { key: 'email', label: 'Email', schema: 'text' },
        { key: 'hours', label: 'Hours', schema: 'text' }, { key: 'whatsapp', label: 'WhatsApp number (digits)', schema: 'text' },
        { key: 'map_embed_url', label: 'Google Maps embed URL', schema: 'text', col: 'col-12' },
    ] },
    'contact.topics': strings('topic'),
    trust_points: strings('point'),
    payment_badges: strings('badge'),
    'product.shipping_points': strings('point'),
    'product.care_instructions': strings('instruction'),
    about: { type: 'object', fields: [
        { key: 'story', label: 'Story paragraphs', schema: { type: 'list', label: 'paragraph', of: 'textarea' } },
        { key: 'stats', label: 'Stats', schema: { type: 'list', label: 'stat', of: { type: 'object', fields: [{ key: 'value', label: 'Value', schema: 'number', col: 'col-md-3' }, { key: 'suffix', label: 'Suffix', schema: 'text', col: 'col-md-2' }, { key: 'label', label: 'Label', schema: 'text', col: 'col-md-7' }] } } },
        { key: 'values', label: 'Values', schema: { type: 'list', label: 'value', of: { type: 'object', fields: [{ key: 'icon', label: 'Icon', schema: 'text', col: 'col-md-2' }, { key: 'title', label: 'Title', schema: 'text', col: 'col-md-10' }, { key: 'text', label: 'Text', schema: 'textarea' }] } } },
        { key: 'milestones', label: 'Milestones', schema: { type: 'list', label: 'milestone', of: { type: 'object', fields: [{ key: 'year', label: 'Year', schema: 'text', col: 'col-md-2' }, { key: 'title', label: 'Title', schema: 'text', col: 'col-md-10' }, { key: 'text', label: 'Text', schema: 'textarea' }] } } },
    ] },
    services: { type: 'list', label: 'service', of: { type: 'object', fields: [
        { key: 'icon', label: 'Icon', schema: 'text', col: 'col-md-2' }, { key: 'title', label: 'Title', schema: 'text', col: 'col-md-5' }, { key: 'note', label: 'Note', schema: 'text', col: 'col-md-5' },
        { key: 'text', label: 'Text', schema: 'textarea' }, { key: 'to', label: 'Link (optional)', schema: 'text' },
    ] } },
    'configurator.steps': strings('step'),
    'configurator.size_chart': { type: 'list', label: 'row', of: { type: 'object', fields: [{ key: 'us', label: 'US size', schema: 'text', col: 'col-md-4' }, { key: 'diameter', label: 'Diameter', schema: 'text', col: 'col-md-4' }, { key: 'circumference', label: 'Circumference', schema: 'text', col: 'col-md-4' }] } },
    'configurator.size_guide_steps': strings('step'),
    'catalog.sort_options': { type: 'list', label: 'option', of: { type: 'object', fields: [{ key: 'value', label: 'Value (API sort key)', schema: 'text' }, { key: 'label', label: 'Label', schema: 'text' }] } },
    'catalog.stone_filters': strings('filter'),
    'catalog.max_price_filter': 'money',
    'catalog.rating_distribution': { type: 'list', label: 'row', of: { type: 'object', fields: [{ key: 'stars', label: 'Stars', schema: 'number' }, { key: 'percent', label: 'Percent', schema: 'number' }] } },
};
