import CrudPage, { ActiveBadge } from '../../components/CrudPage';
import { Icon, eur } from '../../components/ui';

export default function ShippingMethods() {
    return (
        <CrudPage
            title="Shipping methods"
            crumbs={[{ label: 'Pricing' }, { label: 'Shipping methods' }]}
            url="/pricing/shipping-methods"
            defaultSort="sort_order"
            newItem={{ is_active: true, free_over_threshold: false, price: 0, sort_order: 0 }}
            columns={[
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Name', sortable: true },
                { key: 'delivery_time', label: 'Delivery' },
                { key: 'price', label: 'Price', sortable: true, className: 'text-end', render: (m) => eur(m.price) },
                { key: 'free_over_threshold', label: 'Free over threshold', render: (m) => (m.free_over_threshold ? <Icon name="check" className="text-green-500" /> : '—') },
                { key: 'is_active', label: 'Status', render: (m) => <ActiveBadge active={m.is_active} /> },
            ]}
            fields={[
                { key: 'code', label: 'Code', col: 'md:col-span-4' },
                { key: 'name', label: 'Name', col: 'md:col-span-8' },
                { key: 'delivery_time', label: 'Delivery time', col: 'md:col-span-6' },
                { key: 'price', label: 'Price (EUR)', type: 'money', col: 'md:col-span-6' },
                { key: 'sort_order', label: 'Order', type: 'number', col: 'md:col-span-4' },
                { key: 'free_over_threshold', label: 'Free over the free-shipping threshold', type: 'check', col: 'md:col-span-8' },
                { key: 'is_active', label: 'Active', type: 'check' },
            ]}
        />
    );
}
