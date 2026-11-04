import { useEffect, useState } from 'react';
import api from '../../api';
import DataTable, { FilterBar } from '../../components/DataTable';
import { Card, Modal, Page, formatDate } from '../../components/ui';

export default function Activity() {
    const [f, setF] = useState({ q: '', log_name: '', from: '', to: '' });
    const [logNames, setLogNames] = useState([]);
    const [open, setOpen] = useState(null);
    useEffect(() => { api.get('/activity', { params: { per_page: 1 } }).then(({ data }) => setLogNames(data.log_names)); }, []);

    const columns = [
        { key: 'created_at', label: 'When', render: (a) => <span className="small text-nowrap">{formatDate(a.created_at)}</span> },
        { key: 'causer', label: 'Who' },
        { key: 'log_name', label: 'Area', render: (a) => <span className="badge text-bg-light border">{a.log_name}</span> },
        { key: 'description', label: 'What', render: (a) => <>{a.description} {a.subject && <span className="small text-secondary">({a.subject})</span>}</> },
        { key: 'props', label: '', className: 'text-end', render: (a) => Object.keys(a.properties || {}).length > 0 && <button className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(a)}>Details</button> },
    ];

    return (
        <Page title="Activity log" crumbs={[{ label: 'System' }, { label: 'Activity' }]}>
            <Card noBody title={
                <FilterBar>
                    <div className="col-auto"><input className="form-control form-control-sm" placeholder="Search…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
                    <div className="col-auto">
                        <select className="form-select form-select-sm" value={f.log_name} onChange={(e) => setF({ ...f, log_name: e.target.value })}>
                            <option value="">All areas</option>{logNames.map((n) => <option key={n}>{n}</option>)}
                        </select>
                    </div>
                    <div className="col-auto"><input type="date" className="form-control form-control-sm" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
                    <div className="col-auto"><input type="date" className="form-control form-control-sm" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
                </FilterBar>
            }>
                <DataTable url="/activity" columns={columns} filters={f} perPage={30} />
            </Card>
            <Modal show={!!open} onClose={() => setOpen(null)} title={open?.description} size="lg">
                {open && <Changes props={open.properties} />}
            </Modal>
        </Page>
    );
}

function Changes({ props }) {
    if (props.attributes) {
        const keys = Object.keys(props.attributes);
        return (
            <table className="table table-sm">
                <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                <tbody>{keys.map((k) => <tr key={k}><td><code>{k}</code></td><td className="small">{fmt(props.old?.[k])}</td><td className="small">{fmt(props.attributes[k])}</td></tr>)}</tbody>
            </table>
        );
    }
    return <pre className="small bg-body-tertiary p-2 rounded">{JSON.stringify(props, null, 2)}</pre>;
}
const fmt = (v) => (v === undefined || v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
