import { useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Card, Page, useFlash, formatDate } from '../../components/ui';
import { Input } from '../../components/form';

export default function Profile() {
    const { user, setUser } = useAuth();
    const [form, setForm] = useState({ name: user.name, current_password: '', password: '', password_confirmation: '' });
    const [errors, setErrors] = useState({});
    const [flash, setFlash] = useFlash();
    const [pw, setPw] = useState('');
    const [codes, setCodes] = useState(null);

    const save = async (e) => {
        e.preventDefault();
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
    return (
        <Page title="My profile" crumbs={[{ label: 'Profile' }]}>
            {flash}
            <div className="row">
                <div className="col-lg-6">
                    <Card title="Account" outline="primary">
                        <form onSubmit={save}>
                            <Input label="Name" {...bind('name')} />
                            <Input label="Email" value={user.email} onChange={() => {}} disabled />
                            <hr />
                            <h6>Change password</h6>
                            <Input label="Current password" type="password" {...bind('current_password')} />
                            <Input label="New password" type="password" {...bind('password')} />
                            <Input label="Confirm new password" type="password" {...bind('password_confirmation')} />
                            <button className="btn btn-primary">Save</button>
                        </form>
                    </Card>
                </div>
                <div className="col-lg-6">
                    {user.two_factor.required ? (
                        <Card title="Two-factor authentication" outline="success">
                            <p><span className="badge text-bg-success">Enabled</span> · {user.two_factor.recovery_codes_left} recovery codes left</p>
                            <p className="small text-secondary">Last sign-in: {formatDate(user.last_login_at)}</p>
                            <div className="input-group">
                                <input type="password" className="form-control" placeholder="Confirm your password" value={pw} onChange={(e) => setPw(e.target.value)} />
                                <button className="btn btn-outline-primary" onClick={regen}>Regenerate recovery codes</button>
                            </div>
                            {codes && <pre className="bg-body-tertiary p-3 rounded mt-3 text-center">{codes.join('\n')}</pre>}
                        </Card>
                    ) : (
                        <Card title="Two-factor authentication" outline="warning">
                            <p><span className="badge text-bg-warning">Disabled</span> · turned off with ADMIN_2FA_ENABLED=false</p>
                            <p className="small text-secondary">Last sign-in: {formatDate(user.last_login_at)}</p>
                        </Card>
                    )}
                    <Card title="Roles">
                        {user.roles.map((r) => <span key={r} className="badge text-bg-primary me-1">{r}</span>)}
                    </Card>
                </div>
            </div>
        </Page>
    );
}
