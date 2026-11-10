import { Link } from 'react-router-dom';
import { useAuth } from '../../auth';
import CrudPage, { ActiveBadge } from '../../components/CrudPage';
import { Callout, Icon, Money, formatDate } from '../../components/ui';
import { B2B_CRUMB, useSalesRepOptions, useTiers } from './shared';

const BUSINESS_TYPES = ['Retail jeweller', 'Wholesaler', 'Boutique / designer', 'Online retailer', 'Other'];

/**
 * Business accounts. A sales person onboards (assigned to them, active at once) and sees only their own;
 * B2B managers see all and choose / change the sales person. Address fields use "address.x" keys so the
 * API's field errors land on them.
 */
export default function Businesses() {
    const { can } = useAuth();
    const manage = can('b2b.manage');
    const canEdit = can(['b2b.sales', 'b2b.manage']);
    const { tiers, countries } = useTiers();
    const reps = useSalesRepOptions(can(['b2b.view', 'b2b.manage']));

    const tierOptions = tiers.map((t) => ({ value: t.id, label: t.name }));

    return (
        <CrudPage
            title="Businesses"
            singular="business"
            crumbs={[B2B_CRUMB, { label: 'Businesses' }]}
            url="/b2b/businesses"
            canDelete={false}
            modalSize="lg"
            newItem={{ is_active: true, tier_id: tiers[0]?.id ?? '', 'address.country_code': countries[0]?.code ?? '' }}
            headerActions={!canEdit && <span className="kt-badge kt-badge-outline">Read only</span>}
            beforeTable={!manage && canEdit && <Callout type="info">Businesses you onboard are linked to you. Their orders and your commission show up under Commissions.</Callout>}
            renderFilters={(filters, setFilters) => (
                <>
                    <select className="kt-select kt-select-sm w-36" value={filters.tier_id || ''} onChange={(e) => setFilters({ ...filters, tier_id: e.target.value })}>
                        <option value="">All tiers</option>
                        {tierOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {reps.length > 0 && (
                        <select className="kt-select kt-select-sm w-44" value={filters.sales_rep_id || ''} onChange={(e) => setFilters({ ...filters, sales_rep_id: e.target.value })}>
                            <option value="">All sales persons</option>
                            <option value="none">No sales person</option>
                            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    )}
                    <select className="kt-select kt-select-sm w-32" value={filters.is_active ?? ''} onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}>
                        <option value="">Any status</option>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                    </select>
                </>
            )}
            extraActions={(b) => (
                <Link to={`/b2b/businesses/${b.id}`} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" title="Orders and stats"><Icon name="chart-line-up" /></Link>
            )}
            transformOut={(v) => ({
                company_name: v.company_name, business_type: v.business_type || null, tax_id: v.tax_id || null,
                first_name: v.first_name, last_name: v.last_name || null, email: v.email, phone: v.phone || null,
                password: v.password || null, tier_id: v.tier_id ? Number(v.tier_id) : null,
                sales_rep_id: v.sales_rep_id ? Number(v.sales_rep_id) : null, is_active: !!v.is_active, notes: v.notes || null,
                address: v['address.line1'] ? {
                    line1: v['address.line1'], city: v['address.city'], state: v['address.state'] || null,
                    zip: v['address.zip'], country_code: v['address.country_code'],
                } : null,
            })}
            columns={[
                { key: 'company_name', label: 'Business', render: (b) => (
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-mono">{b.company_name}</span>
                        <span className="text-xs text-secondary-foreground">{b.contact_name} · {b.email}</span>
                    </div>
                ) },
                { key: 'tier', label: 'Tier', render: (b) => (b.tier ? <span className="kt-badge kt-badge-sm kt-badge-warning kt-badge-outline"><Icon name="crown-2" /> {b.tier.name}</span> : '—') },
                ...(manage || reps.length ? [{ key: 'sales_rep', label: 'Sales person', render: (b) => <span className="text-sm">{b.sales_rep?.name || <span className="text-muted-foreground">none</span>}</span> }] : []),
                { key: 'orders_count', label: 'Orders', className: 'text-end', render: (b) => <span className="text-sm">{b.orders_count}</span> },
                { key: 'sales', label: 'Sales', className: 'text-end', render: (b) => <span className="text-sm"><Money value={b.sales} /></span> },
                { key: 'commission', label: 'Commission', className: 'text-end', render: (b) => <span className="text-sm"><Money value={b.commission} /></span> },
                { key: 'last_order_at', label: 'Last order', render: (b) => <span className="text-sm text-secondary-foreground">{b.last_order_at ? formatDate(b.last_order_at, false) : '—'}</span> },
                { key: 'is_active', label: 'Status', render: (b) => <ActiveBadge active={b.is_active} /> },
            ]}
            fields={[
                { key: 'company_name', label: 'Company name', col: 'md:col-span-6' },
                { key: 'business_type', label: 'Business type', type: 'select', options: BUSINESS_TYPES, placeholder: '—', col: 'md:col-span-3' },
                { key: 'tax_id', label: 'Tax / GST / VAT no.', col: 'md:col-span-3' },
                { key: 'first_name', label: 'Contact first name', col: 'md:col-span-4' },
                { key: 'last_name', label: 'Last name', col: 'md:col-span-4' },
                { key: 'phone', label: 'Phone', col: 'md:col-span-4' },
                { key: 'email', label: 'Login email', col: 'md:col-span-6' },
                { key: 'password', label: 'Password (min 8)', col: 'md:col-span-6', help: 'The business signs in on the website with this email and password.', hidden: (i) => !!i.id },
                { key: 'password', label: 'New password (optional)', col: 'md:col-span-6', help: 'Leave empty to keep the current one. Changing it signs the business out.', hidden: (i) => !i.id },
                { key: 'tier_id', label: 'Membership tier', type: 'select', options: tierOptions, placeholder: 'Choose a tier', col: manage ? 'md:col-span-6' : 'md:col-span-12', help: 'Discounts per category are set under Membership tiers.' },
                { key: 'sales_rep_id', label: 'Sales person', type: 'select', options: reps.map((r) => ({ value: r.id, label: r.name })), placeholder: 'No sales person', col: 'md:col-span-6', hidden: () => !manage },
                { key: 'address.line1', label: 'Address', col: 'md:col-span-12', hidden: (i) => !!i.id },
                { key: 'address.city', label: 'City', col: 'md:col-span-4', hidden: (i) => !!i.id },
                { key: 'address.state', label: 'State', col: 'md:col-span-3', hidden: (i) => !!i.id },
                { key: 'address.zip', label: 'ZIP', col: 'md:col-span-2', hidden: (i) => !!i.id },
                { key: 'address.country_code', label: 'Country', type: 'select', options: countries.map((c) => ({ value: c.code, label: c.name })), col: 'md:col-span-3', hidden: (i) => !!i.id },
                { key: 'notes', label: 'Internal notes', type: 'textarea', rows: 2 },
                { key: 'is_active', label: 'Active (can sign in and order)', type: 'check' },
            ]}
        />
    );
}
