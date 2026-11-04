import CrudPage, { ActiveBadge } from '../../components/CrudPage';
import { eur } from '../../components/ui';

const ALL_SIZES = ['3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13'];

export function SizePicker({ value = [], onChange, error }) {
    const list = value || [];
    return (
        <div className="flex flex-col gap-1.5 mb-4">
            <label className="kt-form-label text-sm font-medium text-mono">Allowed sizes (US)</label>
            <div className="flex flex-wrap gap-1.5">
                {ALL_SIZES.map((s) => {
                    const on = list.includes(s);
                    return <button type="button" key={s} className={`kt-btn kt-btn-sm min-w-11 justify-center ${on ? 'kt-btn-primary' : 'kt-btn-outline'}`} onClick={() => onChange(on ? list.filter((x) => x !== s) : [...list, s])}>{s}</button>;
                })}
            </div>
            <div className="flex gap-4 text-sm">
                <button type="button" className="kt-link" onClick={() => onChange(ALL_SIZES.filter((s) => parseFloat(s) >= 4 && parseFloat(s) <= 12))}>4–12 half sizes</button>
                <button type="button" className="kt-link" onClick={() => onChange([])}>Clear</button>
            </div>
            {error && <div className="text-xs text-destructive">{error}</div>}
        </div>
    );
}

export default function Rings() {
    return (
        <CrudPage
            title="Rings"
            crumbs={[{ label: 'Design Your Ring' }, { label: 'Rings' }]}
            url="/configurator/rings"
            defaultSort="sort_order"
            newItem={{ karat: 18, metal_color: 'yellow', is_active: true, delivery_text: '4-6 weeks', sizes: ALL_SIZES.filter((s) => parseFloat(s) >= 4 && parseFloat(s) <= 12), craft_fee: 0, sort_order: 0 }}
            transformOut={(v) => ({ ...v, metal_color: v.metal_color || null })}
            columns={[
                { key: 'image', label: '', render: (r) => r.image_url && <img src={r.image_url} alt="" className="rounded-lg object-cover border border-border" style={{ width: 44, height: 44 }} /> },
                { key: 'name', label: 'Ring', sortable: true, render: (r) => <><strong>{r.name}</strong><div className="text-xs text-secondary-foreground">{r.type} · {r.setting}</div></> },
                { key: 'karat', label: 'Metal', sortable: true, render: (r) => `${r.karat}K ${r.metal_color || ''}` },
                { key: 'gold_weight_g', label: 'Gold (g)', className: 'text-end' },
                { key: 'craft_fee', label: 'Craft fee', sortable: true, className: 'text-end', render: (r) => eur(r.craft_fee) },
                { key: 'ring_charge', label: 'Ring charge now', className: 'text-end', render: (r) => <span title={`gold ${eur(r.gold_value)}`}>{eur(r.ring_charge)}</span> },
                { key: 'sizes', label: 'Sizes', render: (r) => <span className="text-sm">{r.sizes[0]}–{r.sizes[r.sizes.length - 1]} ({r.sizes.length})</span> },
                { key: 'is_active', label: 'Status', render: (r) => <ActiveBadge active={r.is_active} /> },
            ]}
            fields={[
                { key: 'name', label: 'Name', col: 'md:col-span-6' },
                { key: 'slug', label: 'Slug', col: 'md:col-span-6' },
                { key: 'type', label: 'Type', col: 'md:col-span-6', help: 'e.g. Classic 4-Prong Cathedral' },
                { key: 'setting', label: 'Setting', col: 'md:col-span-6', help: 'e.g. 4-Prong Cathedral' },
                { key: 'karat', label: 'Karat', type: 'select', options: [9, 10, 14, 18, 22, 24].map((k) => ({ value: k, label: `${k}K (${Math.round((k / 24) * 1000) / 10}%)` })), col: 'md:col-span-4' },
                { key: 'metal_color', label: 'Metal colour (display)', type: 'select', options: [{ value: '', label: '—' }, 'yellow', 'white', 'rose'].map((o) => (typeof o === 'string' ? { value: o, label: o } : o)), col: 'md:col-span-4' },
                { key: 'gold_weight_g', label: 'Gold weight (g)', type: 'number', step: '0.001', col: 'md:col-span-4' },
                { key: 'craft_fee', label: 'Craft fee (EUR)', type: 'money', col: 'md:col-span-4' },
                { key: 'delivery_text', label: 'Delivery text', col: 'md:col-span-4' },
                { key: 'sort_order', label: 'Order', type: 'number', col: 'md:col-span-4' },
                { key: 'sizes', label: 'Sizes', type: 'custom', render: (p) => <SizePicker {...p} /> },
                { key: 'image', label: 'Image', type: 'image', folder: 'rings' },
                { key: 'description', label: 'Description', type: 'textarea' },
                { key: 'is_active', label: 'Active', type: 'check' },
            ]}
        />
    );
}
