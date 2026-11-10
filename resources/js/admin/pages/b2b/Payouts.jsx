import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import DataTable, { FilterBar } from '../../components/DataTable';
import { Callout, Icon, Modal, Money, Page, Row, eur, formatDate, useFlash } from '../../components/ui';
import { Input, MoneyInput, Select, Textarea } from '../../components/form';
import { B2B_CRUMB, useSalesRepOptions } from './shared';

/**
 * Commission payouts (EUR). Staff with b2b.payouts record them; sales persons see their own.
 * The form shows the sales person's balance (earned − already paid) and starts with that amount;
 * any smaller amount is a partial payout and the rest stays in the balance.
 */
export default function Payouts() {
    const { can } = useAuth();
    const [params, setParams] = useSearchParams();
    const record = can('b2b.payouts');
    const reps = useSalesRepOptions(can(['b2b.view', 'b2b.manage', 'b2b.payouts']));
    const [f, setF] = useState({ sales_rep_id: params.get('sales_rep_id') || '', from: '', to: '' });
    const [form, setForm] = useState(null);
    const [repTotals, setRepTotals] = useState(null); // {pending, earned, paid, balance} of the chosen sales person
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [reload, setReload] = useState(0);
    const [flash, setFlash] = useFlash();
    const today = new Date().toISOString().slice(0, 10);

    const openRecord = (repId = '') => {
        setErrors({});
        setForm({ sales_rep_id: repId, amount: 0, paid_at: today, method: 'Bank transfer', reference: '', note: '', touched: false });
    };

    // "Pay" links from Commissions / Sales persons: /b2b/payouts?sales_rep_id=5&new=1
    useEffect(() => {
        if (record && params.get('new')) {
            openRecord(params.get('sales_rep_id') || '');
            params.delete('new');
            setParams(params, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params, record]);

    // Balance of the chosen sales person; the amount starts at the full balance until the user types.
    const repId = form?.sales_rep_id;
    useEffect(() => {
        if (!repId) {
            setRepTotals(null);
            return;
        }
        let cancelled = false;
        api.get(`/b2b/sales-reps/${repId}`).then(({ data }) => {
            if (cancelled) return;
            const c = data.data.commission;
            setRepTotals(c);
            setForm((s) => (s && !s.touched ? { ...s, amount: Math.max(0, c.balance.amount) } : s));
        }).catch(() => !cancelled && setRepTotals(null));
        return () => { cancelled = true; };
    }, [repId, reload]);

    const balance = repTotals?.balance.amount ?? null;
    const amount = Number(form?.amount) || 0;
    const over = balance !== null && amount > balance;

    const save = async () => {
        if (over && !window.confirm(`${eur(amount)} is more than the balance of ${eur(balance)}. Record it anyway (advance payment)?`)) return;
        setBusy(true);
        setErrors({});
        try {
            const { touched: _touched, ...body } = form;
            await api.post('/b2b/payouts', { ...body, sales_rep_id: form.sales_rep_id ? Number(form.sales_rep_id) : null });
            const left = balance !== null ? balance - amount : null;
            setForm(null);
            setReload((r) => r + 1);
            setFlash(left !== null && left > 0 ? `Payout recorded. ${eur(left)} is still to pay.` : 'Payout recorded.');
        } catch (e) {
            setErrors(fieldErrors(e));
            if (!e.response?.data?.errors) setFlash(errorMessage(e), 'danger');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (p, reloadTable) => {
        if (!window.confirm(`Delete the payout of ${p.amount.formatted} to ${p.sales_rep?.name}?`)) return;
        try {
            await api.delete(`/b2b/payouts/${p.id}`);
            reloadTable();
            setFlash('Payout deleted.');
        } catch (e) {
            setFlash(errorMessage(e), 'danger');
        }
    };

    const bind = (k) => ({ value: form?.[k], onChange: (v) => setForm({ ...form, [k]: v, ...(k === 'amount' ? { touched: true } : {}) }), error: errors[k] });

    return (
        <Page
            title="Commission payouts"
            crumbs={[B2B_CRUMB, { label: 'Payouts' }]}
            actions={record && <button className="kt-btn kt-btn-primary" onClick={() => openRecord(f.sales_rep_id)}><Icon name="plus" /> Record payout</button>}
        >
            {flash}
            <div className="kt-card kt-card-grid min-w-full">
                <div className="kt-card-header py-3 flex-wrap gap-3">
                    <h3 className="kt-card-title">Payouts</h3>
                    <FilterBar>
                        {reps.length > 0 && (
                            <select className="kt-select kt-select-sm w-48" value={f.sales_rep_id} onChange={(e) => setF({ ...f, sales_rep_id: e.target.value })}>
                                <option value="">All sales persons</option>
                                {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        )}
                        <div className="kt-input kt-input-sm w-40"><Icon name="calendar" /><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} title="From" /></div>
                        <div className="kt-input kt-input-sm w-40"><Icon name="calendar" /><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} title="To" /></div>
                    </FilterBar>
                </div>
                <div className="kt-card-table">
                    <DataTable
                        url="/b2b/payouts"
                        filters={f}
                        reloadKey={reload}
                        empty="No payouts recorded yet."
                        columns={[
                            { key: 'paid_at', label: 'Paid on', render: (p) => <span className="text-sm text-mono">{formatDate(p.paid_at, false)}</span> },
                            { key: 'sales_rep', label: 'Sales person', render: (p) => <span className="text-sm font-medium text-mono">{p.sales_rep?.name || '—'}</span> },
                            { key: 'amount', label: 'Amount', className: 'text-end', render: (p) => <span className="text-sm font-semibold"><Money value={p.amount} /></span> },
                            { key: 'method', label: 'Method', render: (p) => <span className="text-sm">{p.method || '—'}{p.reference && <span className="text-xs text-secondary-foreground block">{p.reference}</span>}</span> },
                            { key: 'note', label: 'Note', render: (p) => <span className="text-sm text-secondary-foreground">{p.note || ''}</span> },
                            { key: 'created_by', label: 'Recorded by', render: (p) => <span className="text-xs text-secondary-foreground">{p.created_by}<br />{formatDate(p.created_at)}</span> },
                            ...(record ? [{ key: '_a', label: '', className: 'text-end w-[1%]', render: (p, reloadTable) => (
                                <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost text-destructive" title="Delete" onClick={() => remove(p, reloadTable)}><Icon name="trash" /></button>
                            ) }] : []),
                        ]}
                    />
                </div>
            </div>

            <Modal show={!!form} onClose={() => setForm(null)} title="Record payout"
                footer={<><button className="kt-btn kt-btn-outline" onClick={() => setForm(null)}>Cancel</button><button className="kt-btn kt-btn-primary" disabled={busy} onClick={save}><Icon name="check" /> Save</button></>}>
                {form && (
                    <div className="grid grid-cols-12 gap-x-5">
                        <div className="col-span-12"><Select label="Sales person" options={reps.map((r) => ({ value: r.id, label: r.name }))} placeholder="Choose…" {...bind('sales_rep_id')} onChange={(v) => setForm({ ...form, sales_rep_id: v, touched: false })} /></div>
                        {repTotals && (
                            <div className="col-span-12 mb-4 rounded-lg border border-border bg-muted/40 px-4 py-2">
                                <Row label="Earned (delivered orders)"><Money value={repTotals.earned} /></Row>
                                <Row label="Already paid"><Money value={repTotals.paid} /></Row>
                                <div className="border-t border-border my-1" />
                                <Row label={<span className="font-semibold text-mono">To pay now</span>}><span className="font-semibold"><Money value={repTotals.balance} /></span></Row>
                                <Row label="Pending (not delivered yet)"><span className="text-secondary-foreground"><Money value={repTotals.pending} /></span></Row>
                            </div>
                        )}
                        <div className="col-span-12 md:col-span-6">
                            <MoneyInput
                                label="Amount (EUR)"
                                {...bind('amount')}
                                help={balance !== null && (
                                    over ? <span className="text-yellow-600">More than the balance: this is an advance.</span>
                                        : amount > 0 && amount < balance ? <>Partial payout: {eur(balance - amount)} stays to pay. <button type="button" className="kt-link" onClick={() => setForm({ ...form, amount: balance, touched: true })}>Pay full balance</button></>
                                            : amount === balance && balance > 0 ? 'Full balance.' : balance <= 0 ? 'Nothing earned is waiting to be paid.' : null
                                )}
                            />
                        </div>
                        <div className="col-span-12 md:col-span-6"><Input label="Paid on" type="date" max={today} {...bind('paid_at')} /></div>
                        <div className="col-span-12 md:col-span-6"><Input label="Method" {...bind('method')} /></div>
                        <div className="col-span-12 md:col-span-6"><Input label="Reference" {...bind('reference')} /></div>
                        <div className="col-span-12"><Textarea label="Note" rows={2} {...bind('note')} /></div>
                        {!form.sales_rep_id && <div className="col-span-12"><Callout type="info">Choose a sales person to see how much commission is waiting to be paid.</Callout></div>}
                    </div>
                )}
            </Modal>
        </Page>
    );
}
