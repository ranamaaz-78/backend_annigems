import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api';
import { Card, Page, Spinner, useFlash } from '../../components/ui';
import SchemaEditor, { BLOCK_SCHEMAS } from '../../components/SchemaEditor';

const KEYS = [
    ['configurator.size_chart', 'Size chart'],
    ['configurator.size_guide_steps', 'How to measure (steps)'],
    ['configurator.steps', 'Configurator step labels'],
];

export default function SizeGuide() {
    const [values, setValues] = useState(null);
    const [flash, setFlash] = useFlash();
    useEffect(() => {
        Promise.all(KEYS.map(([k]) => api.get(`/configurator/size-guide/${k}`))).then((res) => setValues(Object.fromEntries(res.map((r) => [r.data.data.key, r.data.data.value]))));
    }, []);
    if (!values) return <Page title="Size guide"><Spinner /></Page>;

    const save = async (k) => {
        try {
            await api.put(`/configurator/size-guide/${k}`, { value: values[k] });
            setFlash('Saved.');
        } catch (e) {
            setFlash(errorMessage(e), 'danger');
        }
    };

    return (
        <Page title="Size guide" crumbs={[{ label: 'Design Your Ring' }, { label: 'Size guide' }]}>
            {flash}
            {KEYS.map(([k, label]) => (
                <Card key={k} title={label} tools={<button className="btn btn-sm btn-primary" onClick={() => save(k)}>Save</button>}>
                    <SchemaEditor schema={BLOCK_SCHEMAS[k]} value={values[k]} onChange={(v) => setValues({ ...values, [k]: v })} />
                </Card>
            ))}
        </Page>
    );
}
