import { useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Card, Icon, Initials, Page, Row, formatDate, useFlash } from '../../components/ui';
import { Input } from '../../components/form';

export default function Profile() {
    const { user, setUser } = useAuth();
    const [form, setForm] = useState({ name: user.name, current_password: '', password: '', password_confirmation: '' });
    const [errors, setErrors] = useState({});
    const [flash, setFlash] = useFlash();
    const [pw, setPw] = useState('');
    const [codes, setCodes] = useState(null);

    const save = async (e) => {
        e?.preventDefault();
        setErrors({});
        try {
            const { data } = await api.put('/profile', form);
            setUser({ ...user, ...data.data });
            setForm({ ...form, current_password: '', password: '', password_confirmation: '' });
            setFlash('Profile saved.');
        } catch (err) {
            setErrors(fieldErrors(err));
            setFlash(errorMessage(err), 'danger');
        }
    };

    const regen = async () => {
        try {
            const { data } = await api.post('/profile/recovery-codes', { password: pw });
            setCodes(data.recovery_codes);
            setPw('');
        } catch (err) {
            setFlash(fieldErrors(err).password || errorMessage(err), 'danger');
        }
    };

    const bind = (k) => ({ value: form[k], onChange: (v) => setForm({ ...form, [k]: v }), error: errors[k] });
    const tfa = user.two_factor;
    return (
        <Page title="My profile" crumbs={[{ label: 'Profile' }]}>
            {flash}
            <div className="kt-card overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-zinc-900 via-zinc-800 to-yellow-700/70" />
                <div className="kt-card-content flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
                    <Initials name={user.name} className="size-20 text-2xl border-4 border-background bg-primary text-primary-foreground" />
                    <div className="flex flex-col gap-1 grow">
                        <span className="text-lg font-semibold text-mono">{user.name}</span>
                        <span className="text-sm text-secondary-foreground flex items-center gap-1.5"><Icon name="sms" /> {user.email}</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">{user.roles.map((r) => <span key={r} className="kt-badge kt-badge-primary kt-badge-outline">{r}</span>)}</div>
                </div>
            </div>
            <div className="grid lg:grid-cols-2 gap-5 lg:gap-7.5 items-start">
                <Card title="Account" footer={<button className="kt-btn kt-btn-primary ms-auto" onClick={save}><Icon name="check" /> Save changes</button>}>
                    <form onSubmit={save}>
                        <Input label="Name" {...bind('name')} />
                        <Input label="Email" value={user.email} onChange={() => {}} disabled />
                        <div className="border-t border-border my-5" />
                        <h4 className="text-sm font-semibold text-mono mb-3">Change password</h4>
                        <Input label="Current password" type="password" {...bind('current_password')} />
                        <div className="grid sm:grid-cols-2 gap-x-4">
                            <Input label="New password" type="password" {...bind('password')} />
                            <Input label="Confirm new password" type="password" {...bind('password_confirmation')} />
                        </div>
                        <button type="submit" className="hidden" />
                    </form>
                </Card>
                <Card title="Two-factor authentication">
                    {tfa.required !== false ? (
                        <>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="flex items-center justify-center size-11 rounded-xl bg-green-500/10 border border-green-500/20"><Icon name="shield-tick" className="text-xl text-green-600" /></span>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-mono">Enabled</span>
                                    <span className="text-xs text-secondary-foreground">{tfa.recovery_codes_left} recovery codes left</span>
                                </div>
                            </div>
                            <Row label="Last sign-in">{formatDate(user.last_login_at)}</Row>
                            <Row label="Idle timeout">{user.idle_timeout_minutes} minutes</Row>
                            <div className="border-t border-border my-4" />
                            <label className="kt-form-label text-sm font-medium text-mono mb-1.5 block">Regenerate recovery codes</label>
                            <div className="kt-input-group">
                                <input type="password" className="kt-input" placeholder="Confirm your password" value={pw} onChange={(e) => setPw(e.target.value)} />
                                <button className="kt-btn kt-btn-outline" onClick={regen} disabled={!pw}>Regenerate</button>
                            </div>
                            {codes && (
                                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-4 mt-4 font-mono text-sm text-mono text-center page-enter">
                                    {codes.map((c) => <span key={c}>{c}</span>)}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center size-11 rounded-xl bg-yellow-500/10 border border-yellow-500/20"><Icon name="shield-cross" className="text-xl text-yellow-600" /></span>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-mono">Disabled</span>
                                <span className="text-xs text-secondary-foreground">Turned off with ADMIN_2FA_ENABLED=false (local development only).</span>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </Page>
    );
}
