import CrudPage, { ActiveBadge } from '../../components/CrudPage';

export default function Categories() {
    return (
        <CrudPage
            title="Categories"
            crumbs={[{ label: 'Catalog' }, { label: 'Categories' }]}
            url="/categories"
            defaultSort="sort_order"
            newItem={{ is_active: true, sort_order: 0 }}
            columns={[
                { key: 'image', label: '', render: (c) => c.image_url && <img src={c.image_url} alt="" className="rounded" style={{ width: 44, height: 44, objectFit: 'cover' }} /> },
                { key: 'name', label: 'Name', sortable: true },
                { key: 'slug', label: 'Slug' },
                { key: 'products_count', label: 'Products', className: 'text-center' },
                { key: 'sort_order', label: 'Order', sortable: true, className: 'text-center' },
                { key: 'is_active', label: 'Status', render: (c) => <ActiveBadge active={c.is_active} /> },
            ]}
            fields={[
                { key: 'name', label: 'Name', col: 'col-md-6' },
                { key: 'slug', label: 'Slug', col: 'col-md-6', help: 'Used in storefront links (?cat=rings).' },
                { key: 'image', label: 'Image', type: 'image', folder: 'categories' },
                { key: 'sort_order', label: 'Order', type: 'number', col: 'col-md-4' },
                { key: 'is_active', label: 'Active', type: 'check', col: 'col-md-8' },
            ]}
        />
    );
}
