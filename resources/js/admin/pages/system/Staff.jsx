import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api';
import { useAuth } from '../../auth';
import CrudPage, { ActiveBadge } from '../../components/CrudPage';
import { Icon, Initials, formatDate, useFlash } from '../../components/ui';

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
            {flash}
            <CrudPage
                title="Staff"
                singular="staff member"
                crumbs={[{ label: 'System' }, { label: 'Staff' }]}
                url="/staff"
                newItem={{ is_active: true, roles: ['Support'] }}
                transformOut={(v) => ({ name: v.name, email: v.email, roles: v.roles, is_active: v.is_active, password: v.password || null })}
                extraActions={(u, reload) => (
                    <>
                        <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" title="Send password reset link" onClick={() => action(() => api.post(`/staff/${u.id}/password-reset`))}><Icon name="key" /></button>
                        {u.two_factor_enabled && u.id !== user.id && (
                            <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost text-yellow-600" title="Reset 2FA" onClick={() => window.confirm(`Reset 2FA for ${u.name}? They will set it up again at next sign-in.`) && action(() => api.post(`/staff/${u.id}/reset-2fa`)).then(reload)}><Icon name="shield-cross" /></button>
                        )}
                    </>
                )}
                columns={[
                    { key: 'name', label: 'Staff member', render: (u) => (
                        <div className="flex items-center gap-2.5">
                            <Initials name={u.name} />
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-mono">{u.name} {u.id === user.id && <span className="kt-badge kt-badge-sm kt-badge-info kt-badge-outline ms-1">you</span>}</span>
                                <span className="text-xs text-secondary-foreground">{u.email}</span>
                            </div>
                        </div>
                    ) },
                    { key: 'roles', label: 'Roles', render: (u) => <div className="flex flex-wrap gap-1">{u.roles.map((r) => <span key={r} className="kt-badge kt-badge-sm kt-badge-primary kt-badge-outline">{r}</span>)}</div> },
                    { key: 'two_factor_enabled', label: '2FA', render: (u) => (u.two_factor_enabled ? <span className="kt-badge kt-badge-sm kt-badge-success kt-badge-outline"><Icon name="shield-tick" /> on</span> : <span className="kt-badge kt-badge-sm kt-badge-warning kt-badge-outline">pending setup</span>) },
                    { key: 'last_login_at', label: 'Last sign-in', render: (u) => <span className="text-sm text-secondary-foreground">{formatDate(u.last_login_at)}</span> },
                    { key: 'is_active', label: 'Status', render: (u) => <ActiveBadge active={u.is_active} /> },
                ]}
                fields={[
                    { key: 'name', label: 'Name', col: 'md:col-span-6' },
                    { key: 'email', label: 'Email', col: 'md:col-span-6' },
                    { key: 'password', label: 'Initial password (optional, min 10)', hidden: (i) => !!i.id, help: 'Leave empty to email an invitation link instead.' },
                    {
                        key: 'roles', label: 'Roles', type: 'custom', render: ({ value = [], onChange, error }) => (
                            <div className="flex flex-col gap-2 mb-4">
                                <label className="kt-form-label text-sm font-medium text-mono">Roles</label>
                                <div className="grid sm:grid-cols-3 gap-2">
                                    {roles.map((r) => (
                                        <label key={r} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${value.includes(r) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                                            <input className="kt-checkbox kt-checkbox-sm" type="checkbox" checked={value.includes(r)} onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
                                            <span className="text-sm text-mono">{r}</span>
                                        </label>
                                    ))}
                                </div>
                                {error && <div className="text-xs text-destructive">{error}</div>}
                            </div>
                        ),
                    },
                    { key: 'is_active', label: 'Active', type: 'check' },
                ]}
            />
        </>
    );
}
