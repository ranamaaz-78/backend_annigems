import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../../api';
import { useAuth } from '../../auth';
import { ActiveBadge, Alert, Card, Icon, Initials, Money, Page, Row, Skeleton, StatusBadge, eur, formatDate, useFlash } from '../../components/ui';
import { stageLabel } from '../../lib';

export default function CustomerDetail() {
    const { id } = useParams();
    const { can } = useAuth();
    const [u, setU] = useState(null);
    const [error, setError] = useState(null);
    const [flash, setFlash] = useFlash();

    const load = () => api.get(`/customers/${id}`).then(({ data }) => setU(data.data)).catch((e) => setError(errorMessage(e)));
    useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    const run = async (fn) => {
        try {
            const { data } = await fn();
            setFlash(data.message);
            load();
        } catch (e) {
            setFlash(errorMessage(e), 'danger');
        }
    };

    if (error) return <Page title="Customer" crumbs={[{ label: 'Customers', to: '/customers' }]}><Alert>{error}</Alert></Page>;
    if (!u) return <Page title="Customer" crumbs={[{ label: 'Customers', to: '/customers' }]}><div className="kt-card"><div className="kt-card-content grid gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-6" />)}</div></div></Page>;

    return (
        <Page
            title={u.name}
            crumbs={[{ label: 'Customers', to: '/customers' }, { label: u.name }]}
            actions={!u.deleted && can('customers.manage') && (
                <>
                    <button className="kt-btn kt-btn-outline" onClick={() => run(() => api.post(`/customers/${u.id}/reset-code`))}><Icon name="key" /> Send reset code</button>
                    <button className={`kt-btn ${u.is_active ? 'kt-btn-destructive' : 'kt-btn-primary'}`}
                        onClick={() => window.confirm(u.is_active ? 'Deactivate and sign out this customer?' : 'Activate this customer?') && run(() => api.put(`/customers/${u.id}/active`, { is_active: !u.is_active }))}>
                        <Icon name={u.is_active ? 'lock' : 'lock-3'} /> {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                </>
            )}
        >
            {flash}
            <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-start">
                <div className="grid gap-5 lg:gap-7.5">
                    <div className="kt-card">
                        <div className="kt-card-content flex flex-col items-center text-center gap-3 py-8">
                            <Initials name={u.name} className="size-20 text-2xl" />
                            <div className="flex flex-col gap-1">
                                <span className="text-lg font-semibold text-mono">{u.name}</span>
                                <span className="text-sm text-secondary-foreground">{u.email}</span>
                            </div>
                            <div className="flex gap-2">
                                {u.deleted ? <span className="kt-badge kt-badge-mono kt-badge-outline">deleted</span> : <ActiveBadge active={u.is_active} />}
                                {u.google_linked && <span className="kt-badge kt-badge-outline"><Icon name="google" /> Google</span>}
                            </div>
                        </div>
                        <div className="kt-card-footer grid grid-cols-2 divide-x divide-border p-0">
                            <div className="flex flex-col items-center py-4"><span className="text-xl font-semibold text-mono">{u.orders_count}</span><span className="text-xs text-secondary-foreground">Orders</span></div>
                            <div className="flex flex-col items-center py-4"><span className="text-xl font-semibold text-mono">{eur(u.lifetime_value_eur)}</span><span className="text-xs text-secondary-foreground">Lifetime value</span></div>
                        </div>
                    </div>
                    <Card title="Details">
                        <Row label="Phone">{u.phone || '—'}</Row>
                        <Row label="Sign-in">{[u.has_password && 'Password', u.google_linked && 'Google'].filter(Boolean).join(' + ') || '—'}</Row>
                        <Row label="Currency">{u.preferred_currency || 'EUR (default)'}</Row>
                        <Row label="Joined">{formatDate(u.created_at)}</Row>
                        <Row label="Last login">{formatDate(u.last_login_at)}</Row>
                    </Card>
                    <Card title="Addresses">
                        <div className="grid gap-3">
                            {u.addresses.map((a) => (
                                <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
                                    <div className="flex items-center gap-2 mb-1"><Icon name="geolocation" className="text-muted-foreground" /><span className="font-medium text-mono">{a.label || 'Address'}</span>{a.is_default && <span className="kt-badge kt-badge-sm kt-badge-primary kt-badge-outline">default</span>}</div>
                                    <div className="text-secondary-foreground leading-6">{a.name}<br />{a.line1}<br />{a.city}{a.state && `, ${a.state}`} {a.zip}<br />{a.country}{a.phone && <><br />{a.phone}</>}</div>
                                </div>
                            ))}
                            {!u.addresses.length && <span className="text-sm text-secondary-foreground">No addresses.</span>}
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-2 grid gap-5 lg:gap-7.5">
                    <div className="kt-card kt-card-grid min-w-full">
                        <div className="kt-card-header">
                            <h3 className="kt-card-title">Orders</h3>
                            {u.orders_count > 0 && <Link className="kt-btn kt-btn-sm kt-btn-outline" to={`/orders?user_id=${u.id}`}>View all <Icon name="black-right" /></Link>}
                        </div>
                        <div className="kt-card-table">
                            <div className="kt-scrollable-x-auto">
                                <table className="kt-table kt-table-border align-middle">
                                    <thead><tr><th>Order</th><th>Status</th><th>Stage</th><th className="text-end">Total</th><th>Date</th></tr></thead>
                                    <tbody>
                                        {u.orders.map((o) => (
                                            <tr key={o.order_number}>
                                                <td className="whitespace-nowrap"><Link to={`/orders/${o.order_number}`} className="text-sm font-medium text-mono hover:text-primary">{o.order_number}</Link></td>
                                                <td><StatusBadge value={o.status} /></td>
                                                <td className="text-sm">{stageLabel(o.stage)}</td>
                                                <td className="text-end text-sm font-medium"><Money value={o.total} /></td>
                                                <td className="text-sm text-secondary-foreground">{formatDate(o.created_at)}</td>
                                            </tr>
                                        ))}
                                        {!u.orders.length && <tr><td colSpan={5} className="text-center text-sm text-secondary-foreground py-8">No orders yet.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <Card title="Wishlist" tools={<span className="kt-badge kt-badge-sm kt-badge-outline">{u.wishlist.length}</span>}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {u.wishlist.map((p) => (
                                <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-border p-2.5 hover-lift">
                                    {p.image_url && <img src={p.image_url} alt="" className="rounded-md aspect-square object-cover" />}
                                    <span className="text-sm font-medium text-mono leading-tight">{p.name}</span>
                                    <span className="text-xs text-secondary-foreground">{eur(p.price)}</span>
                                </div>
                            ))}
                            {!u.wishlist.length && <span className="text-sm text-secondary-foreground col-span-full">Wishlist is empty.</span>}
                        </div>
                    </Card>
                    <div className="kt-card kt-card-grid min-w-full">
                        <div className="kt-card-header"><h3 className="kt-card-title">Signed-in devices</h3></div>
                        <div className="kt-card-table">
                            <table className="kt-table kt-table-border">
                                <thead><tr><th>Device</th><th>Last used</th><th>Created</th><th>Expires</th></tr></thead>
                                <tbody>
                                    {u.tokens.map((t) => (
                                        <tr key={t.id}>
                                            <td className="text-sm"><span className="flex items-center gap-2"><Icon name={t.name.startsWith('mobile') ? 'tablet' : 'screen'} className="text-muted-foreground" />{t.name}</span></td>
                                            <td className="text-sm text-secondary-foreground">{formatDate(t.last_used_at)}</td>
                                            <td className="text-sm text-secondary-foreground">{formatDate(t.created_at)}</td>
                                            <td className="text-sm text-secondary-foreground">{formatDate(t.expires_at)}</td>
                                        </tr>
                                    ))}
                                    {!u.tokens.length && <tr><td colSpan={4} className="text-center text-sm text-secondary-foreground py-6">No active sessions.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </Page>
    );
}
