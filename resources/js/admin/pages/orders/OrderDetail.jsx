import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import Dropdown from '../../components/Dropdown';
import { Alert, Callout, Card, Icon, Initials, Modal, Money, Page, Row, Skeleton, StatusBadge, formatDate, useFlash } from '../../components/ui';
import { Check, Input, Textarea } from '../../components/form';
import { stageLabel } from '../../lib';

const STAGE_ICON = { placed: 'basket', crafting: 'wrench', quality_check: 'shield-tick', shipped: 'delivery', delivered: 'check-circle' };

export default function OrderDetail() {
    const { number } = useParams();
    const { can } = useAuth();
    const [o, setO] = useState(null);
    const [error, setError] = useState(null);
    const [flash, setFlash] = useFlash();
    const [modal, setModal] = useState(null); // 'stage' | 'back' | 'refund' | 'cancel' | 'tracking'
    const [form, setForm] = useState({});
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');

    const load = useCallback(() => api.get(`/orders/${number}`).then(({ data }) => setO(data.data)).catch((e) => setError(errorMessage(e))), [number]);
    useEffect(() => { load(); }, [load]);

    const act = async (method, url, body, okMsg) => {
        setErrors({});
        setBusy(true);
        try {
            const { data } = await api[method](url, body);
            if (data.data?.order_number) setO(data.data);
            setModal(null);
            setFlash(data.message || okMsg);
            return true;
        } catch (e) {
            setErrors(fieldErrors(e));
            if (!e.response?.data?.errors) setFlash(errorMessage(e), 'danger');
            return false;
        } finally {
            setBusy(false);
        }
    };

    if (error) return <Page title="Order" crumbs={[{ label: 'Orders', to: '/orders' }]}><Alert>{error}</Alert></Page>;
    if (!o) {
        return (
            <Page title={`Order ${number}`} crumbs={[{ label: 'Orders', to: '/orders' }, { label: number }]}>
                <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5">
                    <div className="lg:col-span-2 kt-card"><div className="kt-card-content grid gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div></div>
                    <div className="kt-card"><div className="kt-card-content grid gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-5" />)}</div></div>
                </div>
            </Page>
        );
    }

    const paid = ['paid', 'partially_refunded'].includes(o.status);
    const payable = ['pending_payment', 'payment_failed'].includes(o.status);
    const refundableMinor = o.totals.refundable.amount;
    const openModal = (m, f = {}) => { setErrors({}); setForm(f); setModal(m); };
    const f = (k) => ({ value: form[k], onChange: (v) => setForm({ ...form, [k]: v }), error: errors[k] });

    return (
        <Page
            title={<span className="flex items-center gap-2.5">Order {o.order_number} <StatusBadge value={o.status} /> {o.stage && <StatusBadge value={o.stage} label={stageLabel(o.stage)} />}</span>}
            crumbs={[{ label: 'Orders', to: '/orders' }, { label: o.order_number }]}
            actions={
                <>
                    {paid && o.next_stage && can('orders.stage') && (
                        <button className="kt-btn kt-btn-primary" onClick={() => openModal('stage', { stage: o.next_stage, notify: true, carrier: o.carrier || '', tracking_number: o.tracking_number || '', tracking_url: o.tracking_url || '' })}>
                            <Icon name={STAGE_ICON[o.next_stage]} /> Move to {stageLabel(o.next_stage)}
                        </button>
                    )}
                    {payable && can('orders.manage') && <button className="kt-btn kt-btn-destructive" onClick={() => openModal('cancel', { reason: '', notify: true })}><Icon name="cross-circle" /> Cancel order</button>}
                    <Dropdown placement="bottom-end" width="w-60" toggle={<button className="kt-btn kt-btn-outline"><Icon name="dots-vertical" /> More</button>}>
                        {paid && o.previous_stage && can('orders.stage') && (
                            <button className="kt-dropdown-menu-link" data-close onClick={() => openModal('back', { stage: o.previous_stage, note: '' })}><Icon name="arrow-left" /> Back to {stageLabel(o.previous_stage)}</button>
                        )}
                        {paid && can('orders.stage') && <button className="kt-dropdown-menu-link" data-close onClick={() => openModal('tracking', { carrier: o.carrier || '', tracking_number: o.tracking_number || '', tracking_url: o.tracking_url || '' })}><Icon name="delivery-geolocation" /> Edit tracking</button>}
                        {paid && can('orders.refund') && refundableMinor > 0 && <button className="kt-dropdown-menu-link" data-close onClick={() => openModal('refund', { amount: (refundableMinor / 100).toFixed(2), reason: '' })}><Icon name="arrows-loop" /> Refund…</button>}
                        {['paid', 'partially_refunded', 'refunded'].includes(o.status) && can('orders.manage') && (
                            <button className="kt-dropdown-menu-link" data-close onClick={() => act('post', `/orders/${o.order_number}/resend-confirmation`, {}, 'Email queued.')}><Icon name="sms" /> Resend confirmation</button>
                        )}
                        <div className="kt-dropdown-menu-separator" />
                        <a className="kt-dropdown-menu-link" href={`/api/v1/admin/orders/${o.order_number}/invoice`} target="_blank" rel="noreferrer"><Icon name="printer" /> Invoice</a>
                        <a className="kt-dropdown-menu-link" href={`/api/v1/admin/orders/${o.order_number}/packing-slip`} target="_blank" rel="noreferrer"><Icon name="package" /> Packing slip</a>
                        {o.stripe_url && <a className="kt-dropdown-menu-link" href={o.stripe_url} target="_blank" rel="noreferrer"><Icon name="credit-cart" /> Open in Stripe</a>}
                    </Dropdown>
                </>
            }
        >
            {flash}
            {o.stock_issue && <Callout type="danger" title="Stock issue">Stock went below zero when this order was paid. Check availability before crafting.</Callout>}

            <Card title="Fulfilment">
                <Stepper timeline={o.timeline} status={o.status} />
            </Card>

            <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-start">
                <div className="lg:col-span-2 grid gap-5 lg:gap-7.5">
                    <div className="kt-card">
                        <div className="kt-card-header"><h3 className="kt-card-title">Items</h3><span className="text-sm text-secondary-foreground">{o.items.length} line{o.items.length === 1 ? '' : 's'} · {o.currency}</span></div>
                        <div className="kt-card-content p-0">
                            {o.items.map((i) => (
                                <div key={i.id} className="flex flex-col sm:flex-row gap-4 p-5 border-b border-border last:border-b-0">
                                    {i.image_url ? <img src={i.image_url} alt="" className="size-20 rounded-lg object-cover border border-border shrink-0" /> : <span className="size-20 rounded-lg bg-muted shrink-0" />}
                                    <div className="grow flex flex-col gap-1.5 min-w-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-semibold text-mono">{i.name} {i.kind === 'custom_ring' && <span className="kt-badge kt-badge-sm kt-badge-warning kt-badge-outline ms-1"><Icon name="crown" /> Custom ring</span>}</span>
                                                {i.subtitle && <span className="text-xs text-secondary-foreground">{i.subtitle}</span>}
                                                <span className="text-xs text-secondary-foreground">
                                                    {i.size && <>Size <b className="text-mono">{i.size}</b> · </>}Qty <b className="text-mono">{i.qty}</b> × <Money value={i.unit_price} />
                                                    {o.currency !== 'EUR' && <> ({i.unit_price_eur.formatted})</>}
                                                    {i.kind === 'product' && i.snapshot.sku && <> · SKU {i.snapshot.sku}</>}
                                                </span>
                                            </div>
                                            <span className="text-sm font-semibold text-mono whitespace-nowrap"><Money value={i.line_total} /></span>
                                        </div>
                                        {i.breakdown && (
                                            <div className="grid sm:grid-cols-2 gap-x-6 rounded-lg border border-border bg-muted/40 px-4 py-2 mt-1">
                                                <Row label="Ring">{i.snapshot.ring_name} · {i.snapshot.setting}</Row>
                                                <Row label="Metal">{i.snapshot.karat}K {i.snapshot.metal_color || ''} · {i.snapshot.gold_weight_g} g</Row>
                                                <Row label="Gold value">{i.breakdown.gold_value_eur.formatted}</Row>
                                                <Row label="Gold rate">{i.breakdown.gold_rate_per_oz_eur.formatted}/oz <span className="text-muted-foreground">({i.snapshot.gold_rate_source})</span></Row>
                                                <Row label="Craft fee">{i.breakdown.craft_fee_eur.formatted}</Row>
                                                <Row label="Ring charge">{i.breakdown.ring_charge_eur.formatted}</Row>
                                                <Row label="Stone">{i.snapshot.stone_name}: {i.breakdown.stone_price_eur.formatted}</Row>
                                                <Row label="Delivery">{i.snapshot.delivery_text}</Row>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="kt-card-footer justify-end">
                            <div className="w-full sm:w-80">
                                <Row label="Subtotal"><Money value={o.totals.subtotal} /></Row>
                                {o.totals.discount.amount > 0 && <Row label={<>Discount <span className="kt-badge kt-badge-sm kt-badge-outline">{o.coupon_code}</span></>}>−<Money value={o.totals.discount} /></Row>}
                                <Row label={`Shipping · ${o.shipping_method_name}`}><Money value={o.totals.shipping} /></Row>
                                <Row label={`Tax (${Math.round(o.tax_rate * 10000) / 100}%)`}><Money value={o.totals.tax} /></Row>
                                <div className="border-t border-border my-1.5" />
                                <Row label={<span className="font-semibold text-mono">Total</span>}><span className="text-base font-semibold"><Money value={o.totals.total} /></span></Row>
                                {o.currency !== 'EUR' && <Row label={`In EUR (rate ${Number(o.exchange_rate)})`}>{o.totals.total_eur.formatted}</Row>}
                                {o.totals.refunded.amount > 0 && <Row label={<span className="text-destructive">Refunded</span>}><span className="text-destructive">−<Money value={o.totals.refunded} /></span></Row>}
                            </div>
                        </div>
                    </div>

                    <Card title="History">
                        <div className="flex flex-col">
                            {o.history.slice().reverse().map((h, idx, arr) => (
                                <div key={h.id} className="flex items-start relative">
                                    {idx < arr.length - 1 && <div className="w-9 start-0 top-9 absolute bottom-0 translate-x-1/2 border-s border-s-input" />}
                                    <div className="flex items-center justify-center shrink-0 rounded-full bg-accent/60 border border-input size-9 text-secondary-foreground">
                                        <Icon name={h.field === 'stage' ? STAGE_ICON[h.to] || 'abstract-26' : h.to === 'paid' ? 'dollar' : h.to === 'cancelled' ? 'cross-circle' : 'information-2'} className="text-base" />
                                    </div>
                                    <div className="ps-2.5 mb-6 text-base grow">
                                        <div className="flex flex-col">
                                            <div className="text-sm text-foreground">
                                                <span className="font-medium text-mono">{h.field === 'stage' ? 'Stage' : 'Status'}</span>{' '}
                                                {h.from ? (h.field === 'stage' ? stageLabel(h.from) : h.from.replace(/_/g, ' ')) : '—'} → <b>{h.field === 'stage' ? stageLabel(h.to) : h.to.replace(/_/g, ' ')}</b>
                                            </div>
                                            <span className="text-xs text-secondary-foreground">
                                                {formatDate(h.at)} · {h.admin || 'System'}{h.customer_notified && <> · <Icon name="sms" className="text-xs" /> customer notified</>}
                                            </span>
                                            {h.note && <div className="text-sm text-foreground mt-1.5 rounded-md bg-muted/50 px-3 py-2">{h.note}</div>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <div className="grid gap-5 lg:gap-7.5">
                    <Card title="Customer">
                        {o.customer ? (
                            <div className="flex items-center gap-3">
                                <Initials name={o.customer.name} className="size-10 text-sm" />
                                <div className="flex flex-col min-w-0">
                                    <Link to={`/customers/${o.customer.id}`} className="text-sm font-semibold text-mono hover:text-primary">{o.customer.name}</Link>
                                    <span className="text-xs text-secondary-foreground truncate">{o.email}</span>
                                    {o.customer.phone && <span className="text-xs text-secondary-foreground">{o.customer.phone}</span>}
                                </div>
                                {o.customer.deleted && <span className="kt-badge kt-badge-sm kt-badge-secondary ms-auto">deleted</span>}
                            </div>
                        ) : <span className="text-sm">{o.email}</span>}
                        <div className="border-t border-border my-4" />
                        <Row label="Orders">{o.customer?.orders_count ?? '—'}</Row>
                        <Row label="Placed">{formatDate(o.created_at)}</Row>
                        <Row label="Platform"><span className="capitalize">{o.placed_from}</span></Row>
                        {o.paid_at && <Row label="Paid">{formatDate(o.paid_at)}</Row>}
                        {o.customer_note && <div className="mt-3"><Callout type="info" title="Customer note">{o.customer_note}</Callout></div>}
                    </Card>

                    <Card title="Shipping">
                        <div className="flex gap-3">
                            <Icon name="geolocation" className="text-xl text-muted-foreground mt-0.5" />
                            <address className="not-italic text-sm text-foreground leading-6">
                                <span className="font-semibold text-mono">{o.ship_name}</span><br />{o.ship_line1}<br />{o.ship_city}{o.ship_state && `, ${o.ship_state}`} {o.ship_zip}<br />{o.ship_country}
                                {o.ship_phone && <><br />{o.ship_phone}</>}
                            </address>
                        </div>
                        <div className="border-t border-border my-4" />
                        <Row label="Method">{o.shipping_method_name}</Row>
                        <Row label="Delivery">{o.shipping_delivery_time}</Row>
                        {o.tracking_number && (
                            <Row label="Tracking">
                                {o.carrier}: {o.tracking_url ? <a className="kt-link" href={o.tracking_url} target="_blank" rel="noreferrer">{o.tracking_number}</a> : o.tracking_number}
                            </Row>
                        )}
                    </Card>

                    <Card title="Payment">
                        <Row label="Provider"><span className="flex items-center gap-1.5"><Icon name="credit-cart" /> Stripe (card)</span></Row>
                        <Row label="PaymentIntent">{o.stripe_payment_intent_id ? <a href={o.stripe_url} target="_blank" rel="noreferrer" className="kt-link font-mono text-xs">{o.stripe_payment_intent_id}</a> : '—'}</Row>
                        <Row label="Refundable"><Money value={o.totals.refundable} /></Row>
                        {o.cancel_reason && <div className="text-xs text-destructive mt-2">Cancelled: {o.cancel_reason}</div>}
                    </Card>

                    <Card title="Internal notes" description="Visible to staff only">
                        <div className="flex flex-col gap-3">
                            {o.notes.map((n) => (
                                <div key={n.id} className="rounded-lg border border-border bg-muted/40 p-3">
                                    <div className="text-xs text-secondary-foreground mb-1">{n.admin || 'System'} · {formatDate(n.at)}</div>
                                    <div className="text-sm text-foreground whitespace-pre-wrap">{n.body}</div>
                                </div>
                            ))}
                            {!o.notes.length && <span className="text-sm text-secondary-foreground">No notes yet.</span>}
                            {can('orders.manage') && (
                                <div className="flex flex-col gap-2">
                                    <textarea className="kt-textarea" rows={2} placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
                                    <button className="kt-btn kt-btn-sm kt-btn-primary self-end" disabled={!note.trim() || busy} onClick={async () => { if (await act('post', `/orders/${o.order_number}/notes`, { body: note }, 'Note added.')) setNote(''); }}>
                                        <Icon name="message-add" /> Add note
                                    </button>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            <Modal show={modal === 'stage'} onClose={() => setModal(null)} title={`Move to ${stageLabel(form.stage)}`}
                footer={<><button className="kt-btn kt-btn-outline" onClick={() => setModal(null)}>Cancel</button><button className="kt-btn kt-btn-primary" disabled={busy} onClick={() => act('post', `/orders/${o.order_number}/stage`, { ...form, carrier: form.carrier || null, tracking_number: form.tracking_number || null, tracking_url: form.tracking_url || null })}>Update stage</button></>}>
                {form.stage === 'shipped' && (
                    <div className="grid sm:grid-cols-2 gap-x-5">
                        <Input label="Carrier *" {...f('carrier')} />
                        <Input label="Tracking number *" {...f('tracking_number')} />
                        <Input label="Tracking URL" {...f('tracking_url')} className="mb-4 sm:col-span-2" />
                    </div>
                )}
                <Textarea label="Note (optional)" {...f('note')} />
                <Check label="Notify customer by email" checked={form.notify} onChange={(v) => setForm({ ...form, notify: v })} />
                {errors.stage && <Alert>{errors.stage}</Alert>}
            </Modal>

            <Modal show={modal === 'back'} onClose={() => setModal(null)} title={`Step back to ${stageLabel(form.stage)}`}
                footer={<><button className="kt-btn kt-btn-outline" onClick={() => setModal(null)}>Cancel</button><button className="kt-btn kt-btn-primary" disabled={busy} onClick={() => act('post', `/orders/${o.order_number}/stage`, { ...form, notify: false })}>Step back</button></>}>
                <Textarea label="Why? (required)" {...f('note')} />
            </Modal>

            <Modal show={modal === 'tracking'} onClose={() => setModal(null)} title="Tracking"
                footer={<><button className="kt-btn kt-btn-outline" onClick={() => setModal(null)}>Cancel</button><button className="kt-btn kt-btn-primary" disabled={busy} onClick={() => act('put', `/orders/${o.order_number}/tracking`, form)}>Save</button></>}>
                <Input label="Carrier" {...f('carrier')} />
                <Input label="Tracking number" {...f('tracking_number')} />
                <Input label="Tracking URL" {...f('tracking_url')} />
            </Modal>

            <Modal show={modal === 'refund'} onClose={() => setModal(null)} title="Refund through Stripe"
                footer={<><button className="kt-btn kt-btn-outline" onClick={() => setModal(null)}>Cancel</button><button className="kt-btn kt-btn-destructive" disabled={busy} onClick={() => window.confirm('Send this refund to Stripe?') && act('post', `/orders/${o.order_number}/refund`, { amount: Math.round(parseFloat(form.amount || 0) * 100), reason: form.reason })}>Refund</button></>}>
                <Callout type="info">Refundable: <b>{o.totals.refundable.formatted}</b>. The order status updates when Stripe confirms the refund.</Callout>
                <div className="mt-4">
                    <Input label={`Amount (${o.currency})`} type="number" step="0.01" {...f('amount')} help={<button type="button" className="kt-link" onClick={() => setForm({ ...form, amount: (refundableMinor / 100).toFixed(2) })}>Full refund</button>} />
                </div>
                <Textarea label="Reason (internal)" {...f('reason')} />
            </Modal>

            <Modal show={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel unpaid order" size="sm"
                footer={<><button className="kt-btn kt-btn-outline" onClick={() => setModal(null)}>Keep order</button><button className="kt-btn kt-btn-destructive" disabled={busy} onClick={() => act('post', `/orders/${o.order_number}/cancel`, form)}>Cancel order</button></>}>
                <Input label="Reason" {...f('reason')} />
                <Check label="Email the customer" checked={form.notify} onChange={(v) => setForm({ ...form, notify: v })} />
            </Modal>
        </Page>
    );
}

/** Horizontal fulfilment stepper (Metronic stepper look). */
function Stepper({ timeline, status }) {
    const inactive = !['paid', 'partially_refunded', 'refunded'].includes(status);
    return (
        <div className="grid grid-cols-5 gap-2">
            {timeline.map((t, i) => (
                <div key={t.code} className="flex flex-col items-center text-center gap-2 relative">
                    {i > 0 && <div className={`absolute top-5 end-1/2 w-full h-0.5 -z-0 transition-colors duration-500 ${t.done ? 'bg-primary' : 'bg-border'}`} />}
                    <span className={`relative z-[1] flex items-center justify-center size-10 rounded-full border-2 transition-all duration-500 ${t.current ? 'bg-primary border-primary text-white shadow-[0_0_0_5px_var(--color-blue-100)] dark:shadow-none' : t.done ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground'}`}>
                        <Icon name={t.done && !t.current ? 'check' : STAGE_ICON[t.code]} className="text-lg" />
                    </span>
                    <span className={`text-xs sm:text-sm font-medium ${t.done ? 'text-mono' : 'text-secondary-foreground'}`}>{t.label}</span>
                    <span className="text-[11px] text-muted-foreground hidden sm:block">{t.at ? formatDate(t.at) : inactive && i === 0 ? 'awaiting payment' : ''}</span>
                </div>
            ))}
        </div>
    );
}
