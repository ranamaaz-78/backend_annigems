import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { Card, Page, Spinner, useFlash } from '../../components/ui';
import { Check, Input, Textarea } from '../../components/form';

export default function AppSettings() {
    const [s, setS] = useState(null);
    const [errors, setErrors] = useState({});
    const [flash, setFlash] = useFlash();
    useEffect(() => { api.get('/settings').then(({ data }) => setS(data.data)); }, []);
    if (!s) return <Page title="App settings"><Spinner /></Page>;

    const set = (path, v) => {
        const next = structuredClone(s);
        const keys = path.split('.');
        let o = next;
        keys.slice(0, -1).forEach((k) => { o[k] ||= {}; o = o[k]; });
        o[keys[keys.length - 1]] = v;
        setS(next);
    };
    const get = (path) => path.split('.').reduce((o, k) => o?.[k], s);
    const b = (path) => ({ value: get(path), onChange: (v) => set(path, v), error: errors[path] });

    const save = async (e) => {
        e.preventDefault();
        setErrors({});
        try {
            const { data } = await api.put('/settings', s);
            setS(data.data);
            setFlash('Settings saved.');
        } catch (err) {
            setErrors(fieldErrors(err));
            setFlash(errorMessage(err), 'danger');
        }
    };
    const yes = (v) => (v ? <span className="badge text-bg-success">configured</span> : <span className="badge text-bg-danger">missing</span>);

    return (
        <Page title="App settings" crumbs={[{ label: 'System' }, { label: 'App settings' }]}>
            {flash}
            <form onSubmit={save}>
                <div className="row">
                    <div className="col-lg-6">
                        <Card title="Store">
                            <Input label="Store name" {...b('store_name')} />
                            <Input label="Support email (shown to customers)" {...b('support_email')} />
                            <Input label="Staff notification email" {...b('notify_email')} help="New paid orders, contact messages, gold-rate API failures. Empty = MAIL_ADMIN_NOTIFY." />
                        </Card>
                        <Card title="Maintenance (mobile app)" outline={get('maintenance.enabled') ? 'danger' : undefined}>
                            <Check label="Maintenance mode on" checked={get('maintenance.enabled')} onChange={(v) => set('maintenance.enabled', v)} id="maint" />
                            <Textarea label="Message" {...b('maintenance.message')} />
                        </Card>
                        <Card title="Integrations (from .env, read-only)">
                            <p className="mb-1">Stripe: <span className={`badge ${s.stripe_mode === 'live' ? 'text-bg-danger' : 'text-bg-warning'}`}>{s.stripe_mode} mode</span> {yes(s.stripe_configured)} · webhook {yes(s.webhook_configured)}</p>
                            <p className="mb-1">Google client ids: web {yes(s.google_configured.web)} · iOS {yes(s.google_configured.ios)} · Android {yes(s.google_configured.android)}</p>
                            <p className="mb-1">GoldAPI key: {yes(s.gold_api_key_configured)}</p>
                            <p className="mb-0 small text-secondary">Storefront URL (email links): {s.storefront_url}</p>
                        </Card>
                    </div>
                    <div className="col-lg-6">
                        {['ios', 'android'].map((p) => (
                            <Card key={p} title={p === 'ios' ? 'iOS app' : 'Android app'}>
                                <div className="row">
                                    <div className="col-6"><Input label="Minimum version" {...b(`mobile.${p}.min_version`)} /></div>
                                    <div className="col-6"><Input label="Latest version" {...b(`mobile.${p}.latest_version`)} /></div>
                                </div>
                                <Check label="Force update" checked={get(`mobile.${p}.force_update`)} onChange={(v) => set(`mobile.${p}.force_update`, v)} id={`fu-${p}`} />
                            </Card>
                        ))}
                        <button className="btn btn-primary">Save settings</button>
                    </div>
                </div>
            </form>
        </Page>
    );
}
