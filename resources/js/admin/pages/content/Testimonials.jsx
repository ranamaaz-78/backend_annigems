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
                { key: 'name', label: 'Name', sortable: true, render: (t) => <>{t.name}<div className="small text-secondary">{t.location}</div></> },
                { key: 'product_label', label: 'Product' },
                { key: 'rating', label: 'Rating', sortable: true, render: (t) => '★'.repeat(t.rating) },
                { key: 'text', label: 'Text', render: (t) => <span className="small">{t.text.slice(0, 100)}{t.text.length > 100 && '…'}</span> },
                { key: 'sort_order', label: 'Order', sortable: true },
                { key: 'is_active', label: 'Status', render: (t) => <ActiveBadge active={t.is_active} /> },
            ]}
            fields={[
                { key: 'name', label: 'Name', col: 'col-md-5' },
                { key: 'location', label: 'Location', col: 'col-md-5' },
                { key: 'initials', label: 'Initials', col: 'col-md-2' },
                { key: 'product_label', label: 'Product label', col: 'col-md-6' },
                { key: 'rating', label: 'Rating', type: 'select', options: [5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} ★` })), col: 'col-md-3' },
                { key: 'sort_order', label: 'Order', type: 'number', col: 'col-md-3' },
                { key: 'text', label: 'Text', type: 'textarea', rows: 4 },
                { key: 'is_active', label: 'Active', type: 'check' },
            ]}
        />
    );
}
