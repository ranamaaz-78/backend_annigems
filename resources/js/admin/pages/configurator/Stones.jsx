import CrudPage, { ActiveBadge } from '../../components/CrudPage';
import { eur } from '../../components/ui';

/** Live preview of how the storefront renders the gem. */
export function GemSwatch({ stone, size = 48 }) {
    const style = stone.uses_diamond_animation || !stone.gem_style
        ? { background: `conic-gradient(from 0deg, #fff, ${stone.color || '#90caf9'}, #fff, #e3f2fd, #fff)`, animation: stone.uses_diamond_animation ? 'gemspin 3s linear infinite' : undefined }
        : { background: stone.gem_style };
    return (
        <>
            <style>{'@keyframes gemspin { to { transform: rotate(360deg); } }'}</style>
            <span className="gem-swatch" style={{ width: size, height: size, boxShadow: `0 0 18px 6px ${stone.glow || 'transparent'}`, ...style }} />
        </>
    );
}

export default function Stones() {
    return (
        <CrudPage
            title="Stones"
            crumbs={[{ label: 'Design Your Ring' }, { label: 'Stones' }]}
            url="/configurator/stones"
            defaultSort="sort_order"
            newItem={{ is_active: true, price: 0, uses_diamond_animation: false, sort_order: 0, color: '#e53935', glow: 'rgba(229,57,53,0.25)' }}
            columns={[
                { key: 'swatch', label: '', render: (s) => <GemSwatch stone={s} size={32} /> },
                { key: 'name', label: 'Stone', sortable: true, render: (s) => <><strong>{s.name}</strong><div className="text-xs text-secondary-foreground">{s.origin}</div></> },
                { key: 'rarity', label: 'Rarity' },
                { key: 'carat', label: 'Carat', className: 'text-end' },
                { key: 'price', label: 'Price', sortable: true, className: 'text-end', render: (s) => eur(s.price) },
                { key: 'is_active', label: 'Status', render: (s) => <ActiveBadge active={s.is_active} /> },
            ]}
            fields={[
                { key: 'preview', label: 'Preview', type: 'custom', render: ({ item }) => <div className="mb-4 p-6 bg-zinc-950 rounded-xl flex justify-center"><GemSwatch stone={item} size={72} /></div> },
                { key: 'name', label: 'Name', col: 'md:col-span-6' },
                { key: 'slug', label: 'Slug', col: 'md:col-span-6' },
                { key: 'origin', label: 'Origin', col: 'md:col-span-6' },
                { key: 'rarity', label: 'Rarity', col: 'md:col-span-3', help: 'Rare / Premium / Elite…' },
                { key: 'carat', label: 'Carat (display)', type: 'number', step: '0.01', col: 'md:col-span-3' },
                { key: 'price', label: 'Price (EUR, fixed)', type: 'money', col: 'md:col-span-4' },
                { key: 'sort_order', label: 'Order', type: 'number', col: 'md:col-span-4' },
                { key: 'color', label: 'Colour', type: 'color', col: 'md:col-span-4' },
                { key: 'glow', label: 'Glow (rgba)', col: 'md:col-span-6' },
                { key: 'uses_diamond_animation', label: 'Use diamond animation instead of a gradient', type: 'check', col: 'md:col-span-6' },
                { key: 'gem_style', label: 'Gem style (CSS gradient)', type: 'textarea', rows: 2, hidden: (i) => i.uses_diamond_animation },
                { key: 'description', label: 'Description', type: 'textarea' },
                { key: 'is_active', label: 'Active', type: 'check' },
            ]}
        />
    );
}
