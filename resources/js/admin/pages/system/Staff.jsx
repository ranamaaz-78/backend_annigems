import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api';
import { useAuth } from '../../auth';
import CrudPage, { ActiveBadge } from '../../components/CrudPage';
import { formatDate, useFlash } from '../../components/ui';

export default function Staff() {
    const { user } = useAuth();
    const [roles, setRoles] = useState([]);
    const [flash, setFlash] = useFlash();
    useEffect(() => { api.get('/roles').then(({ data }) => setRoles(data.data.roles.map((r) => r.name))); }, []);

    const action = async (fn) => {
        try {
            const { data } = await fn();
            setFlash(data.message);
        } catch (e) {
            setFlash(errorMessage(e), 'danger');
        }
    };

    return (
        <>
            <div className="px-3 pt-3">{flash}</div>
            <CrudPage
                title="Staff"
                crumbs={[{ label: 'System' }, { label: 'Staff' }]}
                url="/staff"
                newItem={{ is_active: true, roles: ['Support'] }}
                transformOut={(v) => ({ name: v.name, email: v.email, roles: v.roles, is_active: v.is_active, password: v.password || null })}
                extraActions={(u, reload) => (
                    <>
                        <button className="btn btn-outline-secondary" title="Send password reset link" onClick={() => action(() => api.post(`/staff/${u.id}/password-reset`))}><i className="bi bi-key" /></button>
                        {u.two_factor_enabled && u.id !== user.id && (
                            <button className="btn btn-outline-warning" title="Reset 2FA" onClick={() => window.confirm(`Reset 2FA for ${u.name}? They will set it up again at next sign-in.`) && action(() => api.post(`/staff/${u.id}/reset-2fa`)).then(reload)}><i className="bi bi-shield-x" /></button>
                        )}
                    </>
                )}
                columns={[
                    { key: 'name', label: 'Name', render: (u) => <>{u.name} {u.id === user.id && <span className="badge text-bg-info">you</span>}<div className="small text-secondary">{u.email}</div></> },
                    { key: 'roles', label: 'Roles', render: (u) => u.roles.map((r) => <span key={r} className="badge text-bg-primary me-1">{r}</span>) },
                    { key: 'two_factor_enabled', label: '2FA', render: (u) => (u.two_factor_enabled ? <span className="badge text-bg-success">on</span> : <span className="badge text-bg-warning">pending setup</span>) },
                    { key: 'last_login_at', label: 'Last sign-in', render: (u) => <span className="small">{formatDate(u.last_login_at)}</span> },
                    { key: 'is_active', label: 'Status', render: (u) => <ActiveBadge active={u.is_active} /> },
                ]}
                fields={[
                    { key: 'name', label: 'Name', col: 'col-md-6' },
                    { key: 'email', label: 'Email', col: 'col-md-6' },
                    { key: 'password', label: 'Initial password (optional, min 10)', hidden: (i) => !!i.id, help: 'Leave empty to email an invitation link instead.' },
                    {
                        key: 'roles', label: 'Roles', type: 'custom', render: ({ value = [], onChange, error }) => (
                            <div className="mb-3">
                                <label className="form-label">Roles</label>
                                {roles.map((r) => (
                                    <div className="form-check" key={r}>
                                        <input className="form-check-input" type="checkbox" id={`role-${r}`} checked={value.includes(r)} onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
                                        <label className="form-check-label" htmlFor={`role-${r}`}>{r}</label>
                                    </div>
                                ))}
                                {error && <div className="invalid-feedback d-block">{error}</div>}
                            </div>
                        ),
                    },
                    { key: 'is_active', label: 'Active', type: 'check' },
                ]}
            />
        </>
    );
}
