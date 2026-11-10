import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import CrudPage, { ActiveBadge } from '../../components/CrudPage';
import { Callout, Icon, Initials, Money, formatDate } from '../../components/ui';
import { B2B_CRUMB } from './shared';

/**
 * Sales persons: an admin login with the Sales Person role + commission %. They sign in to this admin
 * panel and only see B2B screens with their own businesses. Deactivate instead of deleting, so their
 * orders and commission history stay.
 */
export default function SalesReps() {
    const { can } = useAuth();
    const navigate = useNavigate();
    const manage = can('b2b.manage');

    return (
        <CrudPage
            title="Sales persons"
            singular="sales person"
            crumbs={[B2B_CRUMB, { label: 'Sales persons' }]}
            url="/b2b/sales-reps"
            canDelete={false}
            modalSize=""
            newItem={{ is_active: true, commission_rate: 10 }}
            beforeTable={manage && (
                <Callout type="info">
                    A sales person signs in to this admin panel with their email and password (and 2FA when it is on) and only sees their own businesses, orders and commission.
                    Changing the commission % applies to new orders only.
                </Callout>
            )}
            extraActions={(r) => (
                <>
                    {can('b2b.payouts') && r.commission.balance.amount > 0 && (
                        <button className="kt-btn kt-btn-sm kt-btn-outline" title={`Record a payout (balance ${r.commission.balance.formatted})`} onClick={() => navigate(`/b2b/payouts?sales_rep_id=${r.id}&new=1`)}>Pay</button>
                    )}
                    <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" title="Commission" onClick={() => navigate(`/b2b/commissions?sales_rep_id=${r.id}`)}><Icon name="percentage" /></button>
                </>
            )}
            transformOut={(v) => ({
                name: v.name, email: v.email, phone: v.phone || null, commission_rate: v.commission_rate === '' ? null : Number(v.commission_rate),
                is_active: !!v.is_active, notes: v.notes || null, password: v.password || null,
            })}
            columns={[
                { key: 'name', label: 'Sales person', render: (r) => (
                    <div className="flex items-center gap-2.5">
                        <Initials name={r.name} />
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-mono">{r.name}</span>
                            <span className="text-xs text-secondary-foreground">{r.email}{r.phone && ` · ${r.phone}`}</span>
                        </div>
                    </div>
                ) },
                { key: 'commission_rate', label: 'Commission', className: 'text-end', render: (r) => <span className="text-sm font-medium text-mono">{r.commission_rate}%</span> },
                { key: 'businesses_count', label: 'Businesses', className: 'text-end', render: (r) => <span className="text-sm">{r.businesses_count}</span> },
                { key: 'pending', label: 'Pending', className: 'text-end', render: (r) => <span className="text-sm"><Money value={r.commission.pending} /></span> },
                { key: 'earned', label: 'Earned', className: 'text-end', render: (r) => <span className="text-sm"><Money value={r.commission.earned} /></span> },
                { key: 'balance', label: 'To pay', className: 'text-end', render: (r) => <span className="text-sm font-semibold text-mono"><Money value={r.commission.balance} /></span> },
                { key: 'last_login_at', label: 'Last sign-in', render: (r) => <span className="text-sm text-secondary-foreground">{formatDate(r.last_login_at)}</span> },
                { key: 'is_active', label: 'Status', render: (r) => <ActiveBadge active={r.is_active} /> },
            ]}
            fields={[
                { key: 'name', label: 'Name', col: 'md:col-span-6' },
                { key: 'phone', label: 'Phone', col: 'md:col-span-6' },
                { key: 'email', label: 'Login email', col: 'md:col-span-6' },
                { key: 'commission_rate', label: 'Commission % on order value', type: 'number', col: 'md:col-span-6', help: 'Of the products total after the tier discount (no shipping/tax).' },
                { key: 'password', label: 'Initial password (optional, min 10)', hidden: (i) => !!i.id, help: 'Leave empty to email an invitation link instead.' },
                { key: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
                { key: 'is_active', label: 'Active (can sign in)', type: 'check' },
            ]}
        />
    );
}
