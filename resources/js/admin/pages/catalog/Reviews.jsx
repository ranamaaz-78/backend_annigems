import { useEffect, useState } from 'react';
import api from '../../api';
import CrudPage, { ActiveBadge } from '../../components/CrudPage';

export default function Reviews() {
    const [products, setProducts] = useState([]);
    useEffect(() => { api.get('/products', { params: { all: 1, sort: 'name' } }).then(({ data }) => setProducts(data.data)); }, []);
    const productOptions = [{ value: '', label: 'Generic (all product pages)' }, ...products.map((p) => ({ value: p.id, label: p.name }))];

    return (
        <CrudPage
            title="Reviews"
            crumbs={[{ label: 'Catalog' }, { label: 'Reviews' }]}
            url="/reviews"
            defaultSort="sort_order"
            newItem={{ is_active: true, rating: 5, product_id: '' }}
            transformOut={(v) => ({ ...v, product_id: v.product_id || null })}
            renderFilters={(f, setF) => (
                <select className="kt-select w-56" value={f.product_id || ''} onChange={(e) => setF({ ...f, product_id: e.target.value })}>
                    <option value="">All reviews</option>
                    <option value="generic">Generic only</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            )}
            columns={[
                { key: 'name', label: 'Name', sortable: true, render: (r) => <>{r.name}<div className="text-xs text-secondary-foreground">{r.location}</div></> },
                { key: 'product', label: 'Product', render: (r) => r.product?.name || <span className="kt-badge kt-badge-sm kt-badge-outline">generic</span> },
                { key: 'rating', label: 'Rating', sortable: true, render: (r) => '★'.repeat(r.rating) },
                { key: 'text', label: 'Text', render: (r) => <span className="text-sm">{r.text.slice(0, 90)}{r.text.length > 90 && '…'}</span> },
                { key: 'is_active', label: 'Status', render: (r) => <ActiveBadge active={r.is_active} /> },
            ]}
            fields={[
                { key: 'product_id', label: 'Product', type: 'select', options: productOptions },
                { key: 'name', label: 'Name', col: 'md:col-span-5' },
                { key: 'location', label: 'Location', col: 'md:col-span-5' },
                { key: 'initials', label: 'Initials', col: 'md:col-span-2' },
                { key: 'rating', label: 'Rating', type: 'select', options: [5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} ★` })), col: 'md:col-span-4' },
                { key: 'sort_order', label: 'Order', type: 'number', col: 'md:col-span-4' },
                { key: 'is_active', label: 'Active', type: 'check', col: 'md:col-span-4' },
                { key: 'text', label: 'Review', type: 'textarea', rows: 4 },
            ]}
        />
    );
}
