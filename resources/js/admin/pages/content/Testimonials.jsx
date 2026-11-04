import CrudPage, { ActiveBadge } from '../../components/CrudPage';

export default function Testimonials() {
    return (
        <CrudPage
            title="Testimonials"
            crumbs={[{ label: 'Content' }, { label: 'Testimonials' }]}
            url="/content/testimonials"
            defaultSort="sort_order"
            newItem={{ is_active: true, rating: 5, sort_order: 0 }}
            columns={[
                { key: 'name', label: 'Name', sortable: true, render: (t) => <>{t.name}<div className="text-xs text-secondary-foreground">{t.location}</div></> },
                { key: 'product_label', label: 'Product' },
                { key: 'rating', label: 'Rating', sortable: true, render: (t) => '★'.repeat(t.rating) },
                { key: 'text', label: 'Text', render: (t) => <span className="text-sm">{t.text.slice(0, 100)}{t.text.length > 100 && '…'}</span> },
                { key: 'sort_order', label: 'Order', sortable: true },
                { key: 'is_active', label: 'Status', render: (t) => <ActiveBadge active={t.is_active} /> },
            ]}
            fields={[
                { key: 'name', label: 'Name', col: 'md:col-span-5' },
                { key: 'location', label: 'Location', col: 'md:col-span-5' },
                { key: 'initials', label: 'Initials', col: 'md:col-span-2' },
                { key: 'product_label', label: 'Product label', col: 'md:col-span-6' },
                { key: 'rating', label: 'Rating', type: 'select', options: [5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} ★` })), col: 'md:col-span-3' },
                { key: 'sort_order', label: 'Order', type: 'number', col: 'md:col-span-3' },
                { key: 'text', label: 'Text', type: 'textarea', rows: 4 },
                { key: 'is_active', label: 'Active', type: 'check' },
            ]}
        />
    );
}
