import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { Card, Icon, Page, Spinner, useFlash } from '../../components/ui';
import { Input, MoneyInput } from '../../components/form';

export default function Commerce() {
    const [v, setV] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useFlash();
    const load = (d) => setV({ ...d, tax_percent: Math.round(d.tax_rate * 10000) / 100 });
    useEffect(() => { api.get('/pricing/commerce').then(({ data }) => load(data.data)); }, []);
    if (!v) return <Page title="Tax & shipping" crumbs={[{ label: 'Pricing' }]}><Spinner /></Page>;

    const save = async (e) => {
        e?.preventDefault();
        setErrors({});
        setSaving(true);
        try {
            const { data } = await api.put('/pricing/commerce', { tax_rate: Number(v.tax_percent) / 100, free_shipping_threshold: v.free_shipping_threshold, pending_ttl_hours: v.pending_ttl_hours });
            load(data.data);
            setFlash('Commerce settings saved.');
        } catch (err) {
            setErrors(fieldErrors(err));
            setFlash(errorMessage(err), 'danger');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Page title="Tax & shipping" crumbs={[{ label: 'Pricing' }, { label: 'Tax & shipping' }]}
            actions={<button className="kt-btn kt-btn-primary" onClick={save} disabled={saving}><Icon name="check" /> {saving ? 'Saving…' : 'Save changes'}</button>}>
            {flash}
            <form onSubmit={save} className="grid lg:grid-cols-3 gap-5 lg:gap-7.5">
                <Card title="Tax" description="One flat rate on (subtotal − discount), not on shipping">
                    <Input label="Tax rate (%)" type="number" step="0.01" icon="percentage" value={v.tax_percent} onChange={(x) => setV({ ...v, tax_percent: x })} error={errors.tax_rate} />
                </Card>
                <Card title="Free shipping" description="For methods marked 'free over threshold'">
                    <MoneyInput label="Threshold (EUR)" value={v.free_shipping_threshold} onChange={(x) => setV({ ...v, free_shipping_threshold: x })} error={errors.free_shipping_threshold} help="Compared with (subtotal − discount), converted per currency." />
                </Card>
                <Card title="Unpaid orders" description="Automatic clean-up of abandoned checkouts">
                    <Input label="Lifetime (hours)" type="number" icon="time" value={v.pending_ttl_hours} onChange={(x) => setV({ ...v, pending_ttl_hours: x })} error={errors.pending_ttl_hours} help="pending_payment orders older than this are cancelled." />
                </Card>
                <button type="submit" className="hidden" />
            </form>
        </Page>
    );
}
