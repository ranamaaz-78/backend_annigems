import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { Card, Page, Spinner, useFlash } from '../../components/ui';

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
        } catch (e) {
            setFlash(Object.values(fieldErrors(e))[0] || errorMessage(e), 'danger');
        }
    };

    if (!d) return <Page title="Roles & permissions"><Spinner /></Page>;
    const toggle = (roleId, perm) => setDraft({ ...draft, [roleId]: draft[roleId].includes(perm) ? draft[roleId].filter((p) => p !== perm) : [...draft[roleId], perm] });
    const changed = (r) => JSON.stringify([...draft[r.id]].sort()) !== JSON.stringify([...r.permissions].sort());

    return (
        <Page title="Roles & permissions" crumbs={[{ label: 'System' }, { label: 'Roles' }]}>
            {flash}
            <Card noBody title="Permission matrix"
                tools={<div className="input-group input-group-sm" style={{ width: 300 }}>
                    <input className="form-control" placeholder="New role name" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
                    <button className="btn btn-outline-primary" disabled={!newRole.trim()} onClick={() => call(() => api.post('/roles', { name: newRole, permissions: [] }), 'Role created.').then(() => setNewRole(''))}>Add role</button>
                </div>}>
                <div className="table-responsive">
                    <table className="table table-bordered table-sm align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Permission</th>
                                {d.roles.map((r) => (
                                    <th key={r.id} className="text-center">
                                        {r.name}<div className="small text-secondary fw-normal">{r.users_count} staff</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {d.permissions.map((p) => (
                                <tr key={p.name}>
                                    <td>{p.label}<div className="small text-secondary"><code>{p.name}</code></div></td>
                                    {d.roles.map((r) => (
                                        <td key={r.id} className="text-center">
                                            <input type="checkbox" className="form-check-input" disabled={r.locked} checked={r.locked || draft[r.id]?.includes(p.name)} onChange={() => toggle(r.id, p.name)} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            <tr>
                                <td />
                                {d.roles.map((r) => (
                                    <td key={r.id} className="text-center">
                                        {r.locked ? <span className="small text-secondary">all permissions</span> : (
                                            <div className="btn-group btn-group-sm">
                                                <button className="btn btn-primary" disabled={!changed(r)} onClick={() => call(() => api.put(`/roles/${r.id}`, { permissions: draft[r.id] }), `${r.name} saved.`)}>Save</button>
                                                {!['Manager', 'Support'].includes(r.name) && r.users_count === 0 && (
                                                    <button className="btn btn-outline-danger" onClick={() => window.confirm(`Delete role ${r.name}?`) && call(() => api.delete(`/roles/${r.id}`), 'Role deleted.')}><i className="bi bi-trash" /></button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Card>
        </Page>
    );
}
