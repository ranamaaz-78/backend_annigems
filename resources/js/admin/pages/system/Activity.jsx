import { useEffect, useState } from 'react';
import api from '../../api';
import DataTable, { FilterBar, SearchInput } from '../../components/DataTable';
import { Icon, Initials, Modal, Page, formatDate } from '../../components/ui';

const AREA_ICON = { orders: 'handcart', products: 'diamonds', categories: 'category', settings: 'setting-2', content: 'notepad-edit', staff: 'security-user', customers: 'users', auth: 'shield-tick', messages: 'messages', config_rings: 'crown', config_stones: 'color-swatch', coupons: 'discount' };

export default function Activity() {
    const [f, setF] = useState({ q: '', log_name: '', from: '', to: '' });
    const [logNames, setLogNames] = useState([]);
    const [open, setOpen] = useState(null);
    useEffect(() => { api.get('/activity', { params: { per_page: 1 } }).then(({ data }) => setLogNames(data.log_names)); }, []);

    const columns = [
        { key: 'created_at', label: 'When', render: (a) => <span className="text-sm text-secondary-foreground whitespace-nowrap">{formatDate(a.created_at)}</span> },
        { key: 'causer', label: 'Who', render: (a) => <span className="flex items-center gap-2 text-sm text-mono"><Initials name={a.causer} className="size-7 text-[10px]" />{a.causer}</span> },
        { key: 'log_name', label: 'Area', render: (a) => <span className="kt-badge kt-badge-sm kt-badge-outline"><Icon name={AREA_ICON[a.log_name] || 'abstract-26'} /> {a.log_name}</span> },
        { key: 'description', label: 'What', render: (a) => <div className="flex flex-col"><span className="text-sm text-mono">{a.description}</span>{a.subject && <span className="text-xs text-secondary-foreground">{a.subject}</span>}</div> },
        { key: 'props', label: '', className: 'text-end w-[1%]', render: (a) => Object.keys(a.properties || {}).length > 0 && <button className="kt-btn kt-btn-sm kt-btn-outline" onClick={(e) => { e.stopPropagation(); setOpen(a); }}>Details</button> },
    ];

    return (
        <Page title="Activity log" crumbs={[{ label: 'System' }, { label: 'Activity' }]}>
            <div className="kt-card kt-card-grid min-w-full">
                <div className="kt-card-header py-3 flex-wrap gap-3">
                    <h3 className="kt-card-title">Who changed what</h3>
                    <FilterBar>
                        <SearchInput value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Search activity" />
                        <select className="kt-select w-40" value={f.log_name} onChange={(e) => setF({ ...f, log_name: e.target.value })}>
                            <option value="">All areas</option>{logNames.map((n) => <option key={n}>{n}</option>)}
                        </select>
                        <div className="kt-input w-40"><Icon name="calendar" /><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
                        <div className="kt-input w-40"><Icon name="calendar" /><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
                    </FilterBar>
                </div>
                <div className="kt-card-table">
                    <DataTable url="/activity" columns={columns} filters={f} perPage={30} empty="No activity recorded." onRowClick={(a) => Object.keys(a.properties || {}).length && setOpen(a)} />
                </div>
            </div>
            <Modal show={!!open} onClose={() => setOpen(null)} title={open?.description} size="lg">
                {open && <Changes props={open.properties} />}
            </Modal>
        </Page>
    );
}

function Changes({ props }) {
    if (props.attributes) {
        return (
            <table className="kt-table kt-table-border">
                <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                <tbody>
                    {Object.keys(props.attributes).map((k) => (
                        <tr key={k}>
                            <td className="text-xs font-mono text-mono">{k}</td>
                            <td className="text-xs text-destructive break-all">{fmt(props.old?.[k])}</td>
                            <td className="text-xs text-green-600 break-all">{fmt(props.attributes[k])}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
    return <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto">{JSON.stringify(props, null, 2)}</pre>;
}
const fmt = (v) => (v === undefined || v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
