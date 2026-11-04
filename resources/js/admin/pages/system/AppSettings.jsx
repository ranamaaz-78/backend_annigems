import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { Card, Icon, Page, Row, Spinner, useFlash } from '../../components/ui';
import { Check, Input, Textarea } from '../../components/form';

export default function AppSettings() {
    const [s, setS] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useFlash();
    useEffect(() => { api.get('/settings').then(({ data }) => setS(data.data)); }, []);
    if (!s) return <Page title="App settings" crumbs={[{ label: 'System' }]}><Spinner /></Page>;

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
        e?.preventDefault();
        setErrors({});
        setSaving(true);
        try {
            const { data } = await api.put('/settings', s);
            setS(data.data);
            setFlash('Settings saved.');
        } catch (err) {
            setErrors(fieldErrors(err));
            setFlash(errorMessage(err), 'danger');
        } finally {
            setSaving(false);
        }
    };
    const yes = (v, missing = 'missing') => (v ? <span className="kt-badge kt-badge-sm kt-badge-success kt-badge-outline">configured</span> : <span className="kt-badge kt-badge-sm kt-badge-destructive kt-badge-outline">{missing}</span>);

    return (
        <Page title="App settings" crumbs={[{ label: 'System' }, { label: 'App settings' }]}
            actions={<button className="kt-btn kt-btn-primary" onClick={save} disabled={saving}><Icon name="check" /> {saving ? 'Saving…' : 'Save settings'}</button>}>
            {flash}
            <form onSubmit={save} className="grid lg:grid-cols-2 gap-5 lg:gap-7.5 items-start">
                <div className="grid gap-5 lg:gap-7.5">
                    <Card title="Store" description="Names and email addresses">
                        <Input label="Store name" icon="shop" {...b('store_name')} />
                        <Input label="Support email" icon="sms" {...b('support_email')} help="Shown to customers." />
                        <Input label="Staff notification email" icon="notification-on" {...b('notify_email')} help="New paid orders, contact messages, gold-rate API failures. Empty = MAIL_ADMIN_NOTIFY." />
                    </Card>
                    <Card title="Maintenance (mobile app)" className={get('maintenance.enabled') ? 'border-destructive/40' : ''}>
                        <Check label="Maintenance mode" description="The mobile app shows the message below and blocks usage." checked={get('maintenance.enabled')} onChange={(v) => set('maintenance.enabled', v)} />
                        <Textarea label="Message" {...b('maintenance.message')} />
                    </Card>
                </div>
                <div className="grid gap-5 lg:gap-7.5">
                    <div className="grid sm:grid-cols-2 gap-5 lg:gap-7.5">
                        {[['ios', 'iOS app', 'apple'], ['android', 'Android app', 'android']].map(([p, title, icon]) => (
                            <Card key={p} title={<span className="flex items-center gap-2"><Icon name={icon} /> {title}</span>}>
                                <Input label="Minimum version" {...b(`mobile.${p}.min_version`)} />
                                <Input label="Latest version" {...b(`mobile.${p}.latest_version`)} />
                                <Check className="mb-0" label="Force update" checked={get(`mobile.${p}.force_update`)} onChange={(v) => set(`mobile.${p}.force_update`, v)} />
                            </Card>
                        ))}
                    </div>
                    <Card title="Integrations" description="Read-only, configured in .env">
                        <Row label="Stripe"><span className="flex gap-1.5"><span className={`kt-badge kt-badge-sm ${s.stripe_mode === 'live' ? 'kt-badge-destructive' : 'kt-badge-warning'}`}>{s.stripe_mode} mode</span>{yes(s.stripe_configured)}</span></Row>
                        <Row label="Stripe webhook">{yes(s.webhook_configured)}</Row>
                        <Row label="Google client ids"><span className="flex gap-1.5 flex-wrap justify-end">{['web', 'ios', 'android'].map((k) => <span key={k} className={`kt-badge kt-badge-sm kt-badge-outline ${s.google_configured[k] ? 'kt-badge-success' : 'kt-badge-secondary'}`}>{k}</span>)}</span></Row>
                        <Row label="GoldAPI key">{yes(s.gold_api_key_configured)}</Row>
                        <Row label="Storefront URL"><span className="text-xs font-mono">{s.storefront_url}</span></Row>
                    </Card>
                </div>
                <button type="submit" className="hidden" />
            </form>
        </Page>
    );
}
