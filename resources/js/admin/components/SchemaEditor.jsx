import { ImageInput, MoneyInput } from './form';
import { Icon } from './ui';

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
            <div className="grid grid-cols-12 gap-x-4">
                {schema.fields.map((f) => {
                    const childType = typeof f.schema === 'string' ? f.schema : f.schema.type;
                    const wide = ['object', 'list', 'textarea'].includes(childType);
                    return (
                        <div key={f.key} className={`col-span-12 ${f.col || (wide ? '' : 'md:col-span-6')}`}>
                            <label className={`block font-medium text-mono mb-1.5 ${depth ? 'text-xs' : 'text-sm'}`}>{f.label}</label>
                            <div className={childType === 'object' ? 'rounded-lg border border-border bg-muted/40 p-3 mb-4' : 'mb-4'}>
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
            <div className="flex flex-col gap-2">
                {list.map((item, i) => (
                    <div key={i} className={`flex gap-2 items-start ${itemType === 'object' ? 'rounded-lg border border-border bg-background p-3 pb-0' : ''}`}>
                        {itemType === 'object' && <span className="kt-badge kt-badge-sm kt-badge-outline mt-0.5 shrink-0">{i + 1}</span>}
                        <div className="grow min-w-0">
                            <SchemaEditor schema={schema.of} value={item} onChange={(x) => onChange(list.map((y, j) => (j === i ? x : y)))} depth={depth + 1} />
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                            <button type="button" className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" onClick={() => move(i, -1)} title="Move up"><Icon name="up" /></button>
                            <button type="button" className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" onClick={() => move(i, 1)} title="Move down"><Icon name="down" /></button>
                            <button type="button" className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost text-destructive" onClick={() => onChange(list.filter((_, j) => j !== i))} title="Remove"><Icon name="trash" /></button>
                        </div>
                    </div>
                ))}
                <div>
                    <button type="button" className="kt-btn kt-btn-sm kt-btn-outline" onClick={() => onChange([...list, structuredClone(blank)])}>
                        <Icon name="plus" /> Add {schema.label || 'item'}
                    </button>
                </div>
            </div>
        );
    }

    if (type === 'image') return <ImageInput value={value} onChange={onChange} small={depth > 1} folder="content" />;
    if (type === 'money') return <MoneyInput value={value} onChange={onChange} className="mb-0" />;
    if (type === 'check') return <input type="checkbox" className="kt-switch" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
    if (type === 'textarea') return <textarea className="kt-textarea" rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    if (type === 'number') return <input type="number" className="kt-input" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    return <input className="kt-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
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
        { key: 'eyebrow', label: 'Eyebrow ({since} is replaced by the brand year)', schema: 'text', col: '' },
        { key: 'titleLine1', label: 'Title line 1', schema: 'text' }, { key: 'titleLine2', label: 'Title line 2', schema: 'text' },
        { key: 'text', label: 'Text', schema: 'textarea' }, { key: 'image', label: 'Image', schema: 'image' },
        { key: 'primaryCta', label: 'Button', schema: cta },
    ] },
    'home.usp_items': { type: 'list', label: 'USP', of: { type: 'object', fields: [{ key: 'icon', label: 'Icon', schema: 'text', col: 'md:col-span-2' }, { key: 'label', label: 'Label', schema: 'text', col: 'md:col-span-10' }] } },
    'home.category_section': { type: 'object', fields: [{ key: 'title', label: 'Title', schema: 'text' }, { key: 'subtitle', label: 'Subtitle', schema: 'text' }] },
    'home.design_ring_banner': { type: 'object', fields: [
        { key: 'tag', label: 'Tag', schema: 'text', col: '' }, { key: 'titleLine1', label: 'Title line 1', schema: 'text' }, { key: 'titleLine2', label: 'Title line 2', schema: 'text' },
        { key: 'text', label: 'Text', schema: 'textarea' }, { key: 'cta', label: 'Button', schema: cta },
    ] },
    'home.testimonials_section': { type: 'object', fields: [{ key: 'eyebrow', label: 'Eyebrow', schema: 'text' }, { key: 'title', label: 'Title', schema: 'text' }] },
    'navigation.mega_menu': { type: 'object', fields: [
        { key: 'columns', label: 'Columns', schema: { type: 'list', label: 'column', of: { type: 'object', fields: [{ key: 'heading', label: 'Heading', schema: 'text', col: '' }, { key: 'links', label: 'Links', schema: { type: 'list', label: 'link', of: link } }] } } },
        { key: 'featured', label: 'Featured card', schema: { type: 'object', fields: [{ key: 'tag', label: 'Tag', schema: 'text' }, { key: 'name', label: 'Name', schema: 'text' }, { key: 'to', label: 'Link', schema: 'text' }, { key: 'image', label: 'Image', schema: 'image' }] } },
    ] },
    'navigation.mobile': { type: 'list', label: 'link', of: { type: 'object', fields: [{ key: 'label', label: 'Label', schema: 'text', col: 'md:col-span-5' }, { key: 'to', label: 'Link', schema: 'text', col: 'md:col-span-5' }, { key: 'highlight', label: 'Highlight', schema: 'check', col: 'md:col-span-2' }] } },
    'footer.columns': { type: 'list', label: 'column', of: { type: 'object', fields: [{ key: 'heading', label: 'Heading', schema: 'text', col: '' }, { key: 'links', label: 'Links', schema: { type: 'list', label: 'link', of: link } }] } },
    'footer.legal_links': { type: 'list', label: 'link', of: link },
    contact: { type: 'object', fields: [
        { key: 'address', label: 'Address', schema: 'text', col: '' }, { key: 'phone', label: 'Phone', schema: 'text' }, { key: 'email', label: 'Email', schema: 'text' },
        { key: 'hours', label: 'Hours', schema: 'text' }, { key: 'whatsapp', label: 'WhatsApp number (digits)', schema: 'text' },
        { key: 'map_embed_url', label: 'Google Maps embed URL', schema: 'text', col: '' },
    ] },
    'contact.topics': strings('topic'),
    trust_points: strings('point'),
    payment_badges: strings('badge'),
    'product.shipping_points': strings('point'),
    'product.care_instructions': strings('instruction'),
    about: { type: 'object', fields: [
        { key: 'story', label: 'Story paragraphs', schema: { type: 'list', label: 'paragraph', of: 'textarea' } },
        { key: 'stats', label: 'Stats', schema: { type: 'list', label: 'stat', of: { type: 'object', fields: [{ key: 'value', label: 'Value', schema: 'number', col: 'md:col-span-3' }, { key: 'suffix', label: 'Suffix', schema: 'text', col: 'md:col-span-2' }, { key: 'label', label: 'Label', schema: 'text', col: 'md:col-span-7' }] } } },
        { key: 'values', label: 'Values', schema: { type: 'list', label: 'value', of: { type: 'object', fields: [{ key: 'icon', label: 'Icon', schema: 'text', col: 'md:col-span-2' }, { key: 'title', label: 'Title', schema: 'text', col: 'md:col-span-10' }, { key: 'text', label: 'Text', schema: 'textarea' }] } } },
        { key: 'milestones', label: 'Milestones', schema: { type: 'list', label: 'milestone', of: { type: 'object', fields: [{ key: 'year', label: 'Year', schema: 'text', col: 'md:col-span-2' }, { key: 'title', label: 'Title', schema: 'text', col: 'md:col-span-10' }, { key: 'text', label: 'Text', schema: 'textarea' }] } } },
    ] },
    services: { type: 'list', label: 'service', of: { type: 'object', fields: [
        { key: 'icon', label: 'Icon', schema: 'text', col: 'md:col-span-2' }, { key: 'title', label: 'Title', schema: 'text', col: 'md:col-span-5' }, { key: 'note', label: 'Note', schema: 'text', col: 'md:col-span-5' },
        { key: 'text', label: 'Text', schema: 'textarea' }, { key: 'to', label: 'Link (optional)', schema: 'text' },
    ] } },
    'configurator.steps': strings('step'),
    'configurator.size_chart': { type: 'list', label: 'row', of: { type: 'object', fields: [{ key: 'us', label: 'US size', schema: 'text', col: 'md:col-span-4' }, { key: 'diameter', label: 'Diameter', schema: 'text', col: 'md:col-span-4' }, { key: 'circumference', label: 'Circumference', schema: 'text', col: 'md:col-span-4' }] } },
    'configurator.size_guide_steps': strings('step'),
    'catalog.sort_options': { type: 'list', label: 'option', of: { type: 'object', fields: [{ key: 'value', label: 'Value (API sort key)', schema: 'text' }, { key: 'label', label: 'Label', schema: 'text' }] } },
    'catalog.stone_filters': strings('filter'),
    'catalog.max_price_filter': 'money',
    'catalog.rating_distribution': { type: 'list', label: 'row', of: { type: 'object', fields: [{ key: 'stars', label: 'Stars', schema: 'number' }, { key: 'percent', label: 'Percent', schema: 'number' }] } },
};
