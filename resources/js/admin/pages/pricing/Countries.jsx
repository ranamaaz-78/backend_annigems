import CrudPage, { ActiveBadge } from '../../components/CrudPage';

export default function Countries() {
    return (
        <CrudPage
            title="Countries"
            crumbs={[{ label: 'Pricing' }, { label: 'Countries' }]}
            url="/pricing/countries"
            defaultSort="sort_order"
            newItem={{ is_active: true, sort_order: 0 }}
            canDelete
            columns={[
                { key: 'code', label: 'Code', sortable: true },
                { key: 'name', label: 'Name', sortable: true },
                { key: 'sort_order', label: 'Order', sortable: true },
                { key: 'is_active', label: 'Shipping allowed', render: (c) => <ActiveBadge active={c.is_active} /> },
            ]}
            fields={[
                { key: 'code', label: 'ISO code (2 letters)', col: 'col-md-4' },
                { key: 'name', label: 'Name', col: 'col-md-8' },
                { key: 'sort_order', label: 'Order', type: 'number', col: 'col-md-4' },
                { key: 'is_active', label: 'Shipping allowed', type: 'check', col: 'col-md-8' },
            ]}
        />
    );
}
