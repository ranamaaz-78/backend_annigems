import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Alert, Callout, Card, Modal, Money, Page, Spinner, StatusBadge, formatDate, useFlash } from '../../components/ui';
import { Check, Input, Textarea } from '../../components/form';
import { stageLabel } from '../../lib';

export default function OrderDetail() {
    const { number } = useParams();
    const { can } = useAuth();
    const [o, setO] = useState(null);
    const [error, setError] = useState(null);
    const [flash, setFlash] = useFlash();
    const [modal, setModal] = useState(null); // 'stage' | 'back' | 'refund' | 'cancel' | 'tracking'
    const [form, setForm] = useState({});
    const [errors, setErrors] = useState({});
    const [note, setNote] = useState('');

    const load = useCallback(() => api.get(`/orders/${number}`).then(({ data }) => setO(data.data)).catch((e) => setError(errorMessage(e))), [number]);
    useEffect(() => { load(); }, [load]);

    const act = async (method, url, body, okMsg) => {
        setErrors({});
        try {
            const { data } = await api[method](url, body);
            if (data.data?.order_number) setO(data.data);
            setModal(null);
            setFlash(data.message || okMsg);
        } catch (e) {
            setErrors(fieldErrors(e));
            if (!e.response?.data?.errors) setFlash(errorMessage(e), 'danger');
        }
    };

    if (error) return <Page title="Order"><Alert>{error}</Alert></Page>;
    if (!o) return <Page title="Order"><Spinner /></Page>;

    const paid = ['paid', 'partially_refunded'].includes(o.status);
    const payable = ['pending_payment', 'payment_failed'].includes(o.status);
    const refundableMinor = o.totals.refundable.amount;
    const openModal = (m, f = {}) => { setErrors({}); setForm(f); setModal(m); };
    const f = (k) => ({ value: form[k], onChange: (v) => setForm({ ...form, [k]: v }), error: errors[k] });

    return (
        <Page
            title={`Order ${o.order_number}`}
            crumbs={[{ label: 'Orders', to: '/orders' }, { label: o.order_number }]}
            actions={
                <>
                    {paid && o.next_stage && can('orders.stage') && (
                        <button className="btn btn-primary btn-sm" onClick={() => openModal('stage', { stage: o.next_stage, notify: true, carrier: o.carrier || '', tracking_number: o.tracking_number || '', tracking_url: o.tracking_url || '' })}>
                            <i className="bi bi-arrow-right-circle" /> Move to {stageLabel(o.next_stage)}
                        </button>
                    )}
                    {paid && o.previous_stage && can('orders.stage') && (
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => openModal('back', { stage: o.previous_stage, note: '' })}><i className="bi bi-arrow-left" /> Back to {stageLabel(o.previous_stage)}</button>
                    )}
                    {paid && can('orders.stage') && <button className="btn btn-outline-secondary btn-sm" onClick={() => openModal('tracking', { carrier: o.carrier || '', tracking_number: o.tracking_number || '', tracking_url: o.tracking_url || '' })}><i className="bi bi-truck" /> Tracking</button>}
                    {paid && can('orders.refund') && refundableMinor > 0 && <button className="btn btn-outline-danger btn-sm" onClick={() => openModal('refund', { amount: (refundableMinor / 100).toFixed(2), reason: '' })}><i className="bi bi-arrow-counterclockwise" /> Refund</button>}
                    {payable && can('orders.manage') && <button className="btn btn-outline-danger btn-sm" onClick={() => openModal('cancel', { reason: '', notify: true })}><i className="bi bi-x-circle" /> Cancel</button>}
                    {['paid', 'partially_refunded', 'refunded'].includes(o.status) && can('orders.manage') && (
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => act('post', `/orders/${o.order_number}/resend-confirmation`, {}, 'Email queued.')}><i className="bi bi-envelope" /> Resend confirmation</button>
                    )}
                    <a className="btn btn-outline-dark btn-sm" href={`/api/v1/admin/orders/${o.order_number}/invoice`} target="_blank" rel="noreferrer"><i className="bi bi-printer" /> Invoice</a>
                    <a className="btn btn-outline-dark btn-sm" href={`/api/v1/admin/orders/${o.order_number}/packing-slip`} target="_blank" rel="noreferrer"><i className="bi bi-box-seam" /> Packing slip</a>
                </>
            }
        >
            {flash}
            {o.stock_issue && <Callout type="danger" title="Stock issue">Stock went below zero when this order was paid. Check availability before crafting.</Callout>}
            <div className="row">
                <div className="col-lg-8">
                    <Card title={<>Items <StatusBadge value={o.status} /> {o.stage && <StatusBadge value={o.stage} label={stageLabel(o.stage)} />}</>} noBody>
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead><tr><th /><th>Item</th><th>Size</th><th className="text-center">Qty</th><th className="text-end">Unit</th><th className="text-end">Total</th></tr></thead>
                                <tbody>
                                    {o.items.map((i) => (
                                        <tr key={i.id}>
                                            <td style={{ width: 64 }}>{i.image_url && <img src={i.image_url} alt="" className="rounded" style={{ width: 56, height: 56, objectFit: 'cover' }} />}</td>
                                            <td>
                                                <strong>{i.name}</strong> {i.kind === 'custom_ring' && <span className="badge text-bg-warning">Custom ring</span>}
                                                {i.subtitle && <div className="small text-secondary">{i.subtitle}</div>}
                                                {i.kind === 'product' && i.snapshot.sku && <div className="small text-secondary">SKU {i.snapshot.sku}</div>}
                                                {i.breakdown && (
                                                    <table className="table table-sm table-borderless small mb-0 mt-1 w-auto">
                                                        <tbody>
                                                            <tr><td>Ring</td><td>{i.snapshot.ring_name} · {i.snapshot.setting} · {i.snapshot.karat}K {i.snapshot.metal_color || ''} · {i.snapshot.gold_weight_g} g</td></tr>
                                                            <tr><td>Gold value</td><td>{i.breakdown.gold_value_eur.formatted} <span className="text-secondary">(gold {i.breakdown.gold_rate_per_oz_eur.formatted}/oz, {i.snapshot.gold_rate_source})</span></td></tr>
                                                            <tr><td>Craft fee</td><td>{i.breakdown.craft_fee_eur.formatted}</td></tr>
                                                            <tr><td>Ring charge</td><td>{i.breakdown.ring_charge_eur.formatted}</td></tr>
                                                            <tr><td>Stone</td><td>{i.snapshot.stone_name}: {i.breakdown.stone_price_eur.formatted}</td></tr>
                                                            <tr><td>Delivery</td><td>{i.snapshot.delivery_text}</td></tr>
                                                        </tbody>
                                                    </table>
                                                )}
                                            </td>
                                            <td>{i.size || '—'}</td>
                                            <td className="text-center">{i.qty}</td>
                                            <td className="text-end"><Money value={i.unit_price} />{o.currency !== 'EUR' && <div className="small text-secondary">{i.unit_price_eur.formatted}</div>}</td>
                                            <td className="text-end"><Money value={i.line_total} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-3 border-top">
                            <table className="table table-sm table-borderless w-auto ms-auto mb-0">
                                <tbody>
                                    <tr><td>Subtotal</td><td className="text-end"><Money value={o.totals.subtotal} /></td></tr>
                                    {o.totals.discount.amount > 0 && <tr><td>Discount ({o.coupon_code})</td><td className="text-end">−<Money value={o.totals.discount} /></td></tr>}
                                    <tr><td>Shipping ({o.shipping_method_name})</td><td className="text-end"><Money value={o.totals.shipping} /></td></tr>
                                    <tr><td>Tax ({Math.round(o.tax_rate * 10000) / 100}%)</td><td className="text-end"><Money value={o.totals.tax} /></td></tr>
                                    <tr className="fw-bold"><td>Total</td><td className="text-end"><Money value={o.totals.total} /></td></tr>
                                    {o.currency !== 'EUR' && <tr className="text-secondary"><td>Total in EUR (rate {Number(o.exchange_rate)})</td><td className="text-end">{o.totals.total_eur.formatted}</td></tr>}
                                    {o.totals.refunded.amount > 0 && <tr className="text-danger"><td>Refunded</td><td className="text-end">−<Money value={o.totals.refunded} /></td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card title="Timeline">
                        <div className="d-flex flex-wrap gap-2 mb-3">
                            {o.timeline.map((t) => (
                                <span key={t.code} className={`badge ${t.current ? 'text-bg-primary' : t.done ? 'text-bg-success' : 'text-bg-light border'}`}>
                                    {t.done && <i className="bi bi-check2 me-1" />}{t.label}
                                </span>
                            ))}
                        </div>
                        <div className="timeline">
                            {o.history.slice().reverse().map((h) => (
                                <div key={h.id} className="border-start border-3 ps-3 pb-3 position-relative">
                                    <div className="small text-secondary">{formatDate(h.at)} · {h.admin || 'System'}{h.customer_notified && <> · <i className="bi bi-envelope-check" title="Customer notified" /></>}</div>
                                    <div>
                                        <strong>{h.field === 'stage' ? 'Stage' : 'Status'}:</strong> {h.from ? (h.field === 'stage' ? stageLabel(h.from) : h.from.replace(/_/g, ' ')) : '—'} → {h.field === 'stage' ? stageLabel(h.to) : h.to.replace(/_/g, ' ')}
                                    </div>
                                    {h.note && <div className="small">{h.note}</div>}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <div className="col-lg-4">
                    <Card title="Customer">
                        {o.customer ? (
                            <>
                                <Link to={`/customers/${o.customer.id}`}><strong>{o.customer.name}</strong></Link> {o.customer.deleted && <span className="badge text-bg-secondary">deleted</span>}
                                <div>{o.email}</div>
                                {o.customer.phone && <div>{o.customer.phone}</div>}
                                <div className="small text-secondary">{o.customer.orders_count} order(s)</div>
                            </>
                        ) : o.email}
                        <hr />
                        <div className="small text-secondary">Placed {formatDate(o.created_at)} from <strong>{o.placed_from}</strong>{o.paid_at && <> · paid {formatDate(o.paid_at)}</>}</div>
                        {o.customer_note && <Callout type="info">{o.customer_note}</Callout>}
                    </Card>
                    <Card title="Shipping">
                        <address className="mb-2">
                            <strong>{o.ship_name}</strong><br />{o.ship_line1}<br />{o.ship_city}{o.ship_state && `, ${o.ship_state}`} {o.ship_zip}<br />{o.ship_country}
                            {o.ship_phone && <><br />{o.ship_phone}</>}
                        </address>
                        <div className="small">{o.shipping_method_name} ({o.shipping_delivery_time})</div>
                        {o.tracking_number && (
                            <div className="mt-2">
                                <i className="bi bi-truck" /> {o.carrier}: {o.tracking_url ? <a href={o.tracking_url} target="_blank" rel="noreferrer">{o.tracking_number}</a> : o.tracking_number}
                            </div>
                        )}
                    </Card>
                    <Card title="Payment">
                        <div className="small">Stripe PaymentIntent</div>
                        {o.stripe_payment_intent_id ? <a href={o.stripe_url} target="_blank" rel="noreferrer"><code>{o.stripe_payment_intent_id}</code> <i className="bi bi-box-arrow-up-right" /></a> : '—'}
                        {o.cancel_reason && <div className="mt-2 text-danger small">Cancelled: {o.cancel_reason}</div>}
                    </Card>
                    <Card title="Internal notes">
                        {o.notes.map((n) => (
                            <div key={n.id} className="mb-2 pb-2 border-bottom">
                                <div className="small text-secondary">{n.admin || 'System'} · {formatDate(n.at)}</div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
                            </div>
                        ))}
                        {can('orders.manage') && (
                            <>
                                <textarea className="form-control mb-2" rows={2} placeholder="Add a note (staff only)" value={note} onChange={(e) => setNote(e.target.value)} />
                                <button className="btn btn-sm btn-outline-primary" disabled={!note.trim()} onClick={async () => { await act('post', `/orders/${o.order_number}/notes`, { body: note }, 'Note added.'); setNote(''); }}>Add note</button>
                            </>
                        )}
                    </Card>
                </div>
            </div>

            <Modal show={modal === 'stage'} onClose={() => setModal(null)} title={`Move to ${stageLabel(form.stage)}`}
                footer={<button className="btn btn-primary" onClick={() => act('post', `/orders/${o.order_number}/stage`, { ...form, carrier: form.carrier || null, tracking_number: form.tracking_number || null, tracking_url: form.tracking_url || null })}>Update stage</button>}>
                {form.stage === 'shipped' && (
                    <>
                        <Input label="Carrier *" {...f('carrier')} />
                        <Input label="Tracking number *" {...f('tracking_number')} />
                        <Input label="Tracking URL" {...f('tracking_url')} />
                    </>
                )}
                <Textarea label="Note (optional)" {...f('note')} />
                <Check label="Notify customer by email" checked={form.notify} onChange={(v) => setForm({ ...form, notify: v })} id="notify-stage" />
                {errors.stage && <Alert>{errors.stage}</Alert>}
            </Modal>

            <Modal show={modal === 'back'} onClose={() => setModal(null)} title={`Step back to ${stageLabel(form.stage)}`}
                footer={<button className="btn btn-warning" onClick={() => act('post', `/orders/${o.order_number}/stage`, { ...form, notify: false })}>Step back</button>}>
                <Textarea label="Why? (required)" {...f('note')} />
            </Modal>

            <Modal show={modal === 'tracking'} onClose={() => setModal(null)} title="Tracking"
                footer={<button className="btn btn-primary" onClick={() => act('put', `/orders/${o.order_number}/tracking`, form)}>Save</button>}>
                <Input label="Carrier" {...f('carrier')} />
                <Input label="Tracking number" {...f('tracking_number')} />
                <Input label="Tracking URL" {...f('tracking_url')} />
            </Modal>

            <Modal show={modal === 'refund'} onClose={() => setModal(null)} title="Refund through Stripe"
                footer={<button className="btn btn-danger" onClick={() => window.confirm('Send this refund to Stripe?') && act('post', `/orders/${o.order_number}/refund`, { amount: Math.round(parseFloat(form.amount || 0) * 100), reason: form.reason })}>Refund</button>}>
                <p className="small">Refundable: <strong>{o.totals.refundable.formatted}</strong>. The order status updates when Stripe confirms the refund (webhook).</p>
                <Input label={`Amount (${o.currency})`} type="number" step="0.01" {...f('amount')} />
                <div className="mb-2"><button type="button" className="btn btn-link btn-sm p-0" onClick={() => setForm({ ...form, amount: (refundableMinor / 100).toFixed(2) })}>Full refund</button></div>
                <Textarea label="Reason (internal)" {...f('reason')} />
            </Modal>

            <Modal show={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel unpaid order"
                footer={<button className="btn btn-danger" onClick={() => act('post', `/orders/${o.order_number}/cancel`, form)}>Cancel order</button>}>
                <Input label="Reason" {...f('reason')} />
                <Check label="Email the customer" checked={form.notify} onChange={(v) => setForm({ ...form, notify: v })} id="notify-cancel" />
            </Modal>
        </Page>
    );
}
