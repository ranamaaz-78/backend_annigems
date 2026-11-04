import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../../api';
import { useAuth } from '../../auth';
import { ActiveBadge, Alert, Card, Money, Page, Spinner, StatusBadge, eur, formatDate, useFlash } from '../../components/ui';
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

    if (error) return <Page title="Customer"><Alert>{error}</Alert></Page>;
    if (!u) return <Page title="Customer"><Spinner /></Page>;

    return (
        <Page
            title={u.name}
            crumbs={[{ label: 'Customers', to: '/customers' }, { label: u.name }]}
            actions={!u.deleted && can('customers.manage') && (
                <>
                    <button className={`btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                        onClick={() => window.confirm(u.is_active ? 'Deactivate and sign out this customer?' : 'Activate this customer?') && run(() => api.put(`/customers/${u.id}/active`, { is_active: !u.is_active }))}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => run(() => api.post(`/customers/${u.id}/reset-code`))}><i className="bi bi-key" /> Send password-reset code</button>
                </>
            )}
        >
            {flash}
            <div className="row">
                <div className="col-lg-4">
                    <Card title="Profile" outline="primary">
                        <p className="mb-1"><strong>{u.name}</strong> {u.deleted ? <span className="badge text-bg-dark">deleted</span> : <ActiveBadge active={u.is_active} />}</p>
                        <p className="mb-1">{u.email}</p>
                        {u.phone && <p className="mb-1">{u.phone}</p>}
                        <p className="small text-secondary mb-1">Sign-in: {u.has_password ? 'password' : ''}{u.has_password && u.google_linked ? ' + ' : ''}{u.google_linked ? 'Google' : ''}</p>
                        <p className="small text-secondary mb-1">Preferred currency: {u.preferred_currency || 'EUR (default)'}</p>
                        <p className="small text-secondary mb-0">Joined {formatDate(u.created_at)} · last login {formatDate(u.last_login_at)}</p>
                        <hr />
                        <div className="d-flex justify-content-between"><span>Orders</span><strong>{u.orders_count}</strong></div>
                        <div className="d-flex justify-content-between"><span>Lifetime value</span><strong>{eur(u.lifetime_value_eur)}</strong></div>
                    </Card>
                    <Card title="Addresses">
                        {u.addresses.map((a) => (
                            <address key={a.id} className="small border-bottom pb-2">
                                {a.label && <strong>{a.label} </strong>}{a.is_default && <span className="badge text-bg-primary">default</span>}<br />
                                {a.name}<br />{a.line1}<br />{a.city}{a.state && `, ${a.state}`} {a.zip}<br />{a.country}{a.phone && <><br />{a.phone}</>}
                            </address>
                        ))}
                        {!u.addresses.length && <span className="text-secondary">No addresses.</span>}
                    </Card>
                </div>
                <div className="col-lg-8">
                    <Card title="Orders" noBody tools={u.orders_count > 0 && <Link className="btn btn-sm btn-outline-secondary" to={`/orders?user_id=${u.id}`}>All</Link>}>
                        <table className="table table-sm table-hover mb-0">
                            <thead><tr><th>Order</th><th>Status</th><th>Stage</th><th className="text-end">Total</th><th>Date</th></tr></thead>
                            <tbody>
                                {u.orders.map((o) => (
                                    <tr key={o.order_number}>
                                        <td><Link to={`/orders/${o.order_number}`}>{o.order_number}</Link></td>
                                        <td><StatusBadge value={o.status} /></td>
                                        <td>{stageLabel(o.stage)}</td>
                                        <td className="text-end"><Money value={o.total} /></td>
                                        <td className="small">{formatDate(o.created_at)}</td>
                                    </tr>
                                ))}
                                {!u.orders.length && <tr><td colSpan={5} className="text-secondary text-center py-3">No orders.</td></tr>}
                            </tbody>
                        </table>
                    </Card>
                    <Card title="Wishlist">
                        <div className="d-flex flex-wrap gap-3">
                            {u.wishlist.map((p) => (
                                <div key={p.id} className="text-center" style={{ width: 110 }}>
                                    {p.image_url && <img src={p.image_url} alt="" className="rounded mb-1" style={{ width: 90, height: 90, objectFit: 'cover' }} />}
                                    <div className="small">{p.name}</div>
                                    <div className="small text-secondary">{eur(p.price)}</div>
                                </div>
                            ))}
                            {!u.wishlist.length && <span className="text-secondary">Empty.</span>}
                        </div>
                    </Card>
                    <Card title="Signed-in devices (tokens)" noBody>
                        <table className="table table-sm mb-0">
                            <thead><tr><th>Device</th><th>Last used</th><th>Created</th><th>Expires</th></tr></thead>
                            <tbody>
                                {u.tokens.map((t) => <tr key={t.id}><td>{t.name}</td><td>{formatDate(t.last_used_at)}</td><td>{formatDate(t.created_at)}</td><td>{formatDate(t.expires_at)}</td></tr>)}
                                {!u.tokens.length && <tr><td colSpan={4} className="text-secondary text-center">None.</td></tr>}
                            </tbody>
                        </table>
                    </Card>
                </div>
            </div>
        </Page>
    );
}
