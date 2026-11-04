import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { Card, Page, Spinner, useFlash } from '../../components/ui';
import { Input, MoneyInput } from '../../components/form';

export default function Commerce() {
    const [v, setV] = useState(null);
    const [errors, setErrors] = useState({});
    const [flash, setFlash] = useFlash();
    useEffect(() => { api.get('/pricing/commerce').then(({ data }) => setV({ ...data.data, tax_percent: Math.round(data.data.tax_rate * 10000) / 100 })); }, []);
    if (!v) return <Page title="Tax & shipping"><Spinner /></Page>;

    const save = async (e) => {
        e.preventDefault();
        setErrors({});
        try {
            const { data } = await api.put('/pricing/commerce', { tax_rate: Number(v.tax_percent) / 100, free_shipping_threshold: v.free_shipping_threshold, pending_ttl_hours: v.pending_ttl_hours });
            setV({ ...data.data, tax_percent: Math.round(data.data.tax_rate * 10000) / 100 });
            setFlash('Saved.');
        } catch (err) {
            setErrors(fieldErrors(err));
            setFlash(errorMessage(err), 'danger');
        }
    };

    return (
        <Page title="Tax & shipping" crumbs={[{ label: 'Pricing' }, { label: 'Tax & shipping' }]}>
            {flash}
            <div className="row"><div className="col-lg-6">
                <Card title="Commerce settings" outline="primary">
                    <form onSubmit={save}>
                        <Input label="Tax rate (%)" type="number" step="0.01" value={v.tax_percent} onChange={(x) => setV({ ...v, tax_percent: x })} error={errors.tax_rate} help="One flat rate applied to (subtotal − discount), not to shipping." />
                        <MoneyInput label="Free-shipping threshold (EUR)" value={v.free_shipping_threshold} onChange={(x) => setV({ ...v, free_shipping_threshold: x })} error={errors.free_shipping_threshold} help="Applies to methods marked 'free over threshold' when (subtotal − discount) reaches it. Converted per currency." />
                        <Input label="Unpaid order lifetime (hours)" type="number" value={v.pending_ttl_hours} onChange={(x) => setV({ ...v, pending_ttl_hours: x })} error={errors.pending_ttl_hours} help="pending_payment orders older than this are cancelled automatically." />
                        <button className="btn btn-primary">Save</button>
                    </form>
                </Card>
            </div></div>
        </Page>
    );
}
