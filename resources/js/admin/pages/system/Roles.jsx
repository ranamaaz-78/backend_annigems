import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { Icon, Page, Spinner, useFlash } from '../../components/ui';

export default function Roles() {
    const [d, setD] = useState(null);
    const [draft, setDraft] = useState({});
    const [newRole, setNewRole] = useState('');
    const [flash, setFlash] = useFlash();

    const apply = (data) => {
        setD(data.data);
        setDraft(Object.fromEntries(data.data.roles.map((r) => [r.id, r.permissions])));
    };
    useEffect(() => { api.get('/roles').then(({ data }) => apply(data)); }, []);

    const call = async (fn, msg) => {
        try {
            const { data } = await fn();
            apply(data);
            setFlash(msg);
            return true;
        } catch (e) {
            setFlash(Object.values(fieldErrors(e))[0] || errorMessage(e), 'danger');
            return false;
        }
    };

    if (!d) return <Page title="Roles & permissions" crumbs={[{ label: 'System' }]}><Spinner /></Page>;
    const toggle = (roleId, perm) => setDraft({ ...draft, [roleId]: draft[roleId].includes(perm) ? draft[roleId].filter((p) => p !== perm) : [...draft[roleId], perm] });
    const changed = (r) => JSON.stringify([...draft[r.id]].sort()) !== JSON.stringify([...r.permissions].sort());

    return (
        <Page title="Roles & permissions" crumbs={[{ label: 'System' }, { label: 'Roles' }]}
            actions={
                <div className="flex gap-2">
                    <input className="kt-input w-48" placeholder="New role name" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
                    <button className="kt-btn kt-btn-primary" disabled={!newRole.trim()} onClick={async () => { if (await call(() => api.post('/roles', { name: newRole, permissions: [] }), 'Role created.')) setNewRole(''); }}><Icon name="plus" /> Add role</button>
                </div>
            }>
            {flash}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {d.roles.map((r) => (
                    <div key={r.id} className="kt-card hover-lift">
                        <div className="kt-card-content flex items-center gap-3">
                            <span className={`flex items-center justify-center size-11 rounded-xl border ${r.locked ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-border text-secondary-foreground'}`}><Icon name={r.locked ? 'crown' : 'security-user'} className="text-xl" /></span>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-mono">{r.name}</span>
                                <span className="text-xs text-secondary-foreground">{r.users_count} staff · {r.locked ? 'all' : r.permissions.length} permissions</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="kt-card kt-card-grid min-w-full">
                <div className="kt-card-header"><h3 className="kt-card-title">Permission matrix</h3><span className="text-sm text-secondary-foreground">Super Admin always has every permission</span></div>
                <div className="kt-card-table">
                    <div className="kt-scrollable-x-auto">
                        <table className="kt-table kt-table-border align-middle">
                            <thead>
                                <tr>
                                    <th className="min-w-[280px]">Permission</th>
                                    {d.roles.map((r) => <th key={r.id} className="text-center min-w-[120px]">{r.name}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {d.permissions.map((p) => (
                                    <tr key={p.name}>
                                        <td>
                                            <div className="flex flex-col">
                                                <span className="text-sm text-mono">{p.label}</span>
                                                <span className="text-xs text-muted-foreground font-mono">{p.name}</span>
                                            </div>
                                        </td>
                                        {d.roles.map((r) => (
                                            <td key={r.id} className="text-center">
                                                <input type="checkbox" className="kt-checkbox kt-checkbox-sm" disabled={r.locked} checked={r.locked || draft[r.id]?.includes(p.name) || false} onChange={() => toggle(r.id, p.name)} />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="kt-card-footer justify-end gap-2.5 flex-wrap">
                    {d.roles.filter((r) => !r.locked).map((r) => (
                        <div key={r.id} className="flex gap-1">
                            <button className="kt-btn kt-btn-sm kt-btn-primary" disabled={!changed(r)} onClick={() => call(() => api.put(`/roles/${r.id}`, { permissions: draft[r.id] }), `${r.name} saved.`)}><Icon name="check" /> Save {r.name}</button>
                            {!['Manager', 'Support'].includes(r.name) && r.users_count === 0 && (
                                <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-outline text-destructive" title={`Delete ${r.name}`} onClick={() => window.confirm(`Delete role ${r.name}?`) && call(() => api.delete(`/roles/${r.id}`), 'Role deleted.')}><Icon name="trash" /></button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </Page>
    );
}
