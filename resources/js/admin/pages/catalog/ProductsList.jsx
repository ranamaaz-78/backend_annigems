import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import DataTable, { FilterBar } from '../../components/DataTable';
import { ActiveBadge, Card, Page, eur } from '../../components/ui';

export default function ProductsList() {
    const navigate = useNavigate();
    const [cats, setCats] = useState([]);
    const [f, setF] = useState({ q: '', category_id: '', is_active: '', featured: '', new_arrival: '', low_stock: '' });
    useEffect(() => { api.get('/categories', { params: { all: 1 } }).then(({ data }) => setCats(data.data)); }, []);

    const columns = [
        { key: 'image', label: '', render: (p) => p.image_url && <img src={p.image_url} alt="" className="rounded" style={{ width: 44, height: 44, objectFit: 'cover' }} /> },
        { key: 'name', label: 'Name', sortable: true, render: (p) => <><strong>{p.name}</strong><div className="small text-secondary">{p.legacy_id && <code className="me-1">{p.legacy_id}</code>}{p.slug}</div></> },
        { key: 'category', label: 'Category', render: (p) => p.category?.name },
        { key: 'price', label: 'Price', sortable: true, className: 'text-end', render: (p) => <>{eur(p.price)}{p.compare_at_price && <div className="small text-secondary text-decoration-line-through">{eur(p.compare_at_price)}</div>}</> },
        { key: 'stock_qty', label: 'Stock', sortable: true, className: 'text-center', render: (p) => (p.track_stock ? <span className={`badge ${p.stock_qty <= 0 ? 'text-bg-danger' : p.stock_qty <= 3 ? 'text-bg-warning' : 'text-bg-light border'}`}>{p.stock_qty}</span> : <span className="small text-secondary">not tracked</span>) },
        { key: 'flags', label: 'Flags', render: (p) => <>{p.badge && <span className="badge text-bg-info me-1">{p.badge}</span>}{p.is_featured && <span className="badge text-bg-primary me-1">Featured #{p.featured_sort}</span>}{p.is_new_arrival && <span className="badge text-bg-success">New #{p.new_arrival_sort}</span>}</> },
        { key: 'is_active', label: 'Status', render: (p) => <ActiveBadge active={p.is_active} /> },
    ];
    const sel = (k) => (e) => setF({ ...f, [k]: e.target.value });

    return (
        <Page title="Products" crumbs={[{ label: 'Catalog' }, { label: 'Products' }]}>
            <Card noBody tools={<Link to="/products/new" className="btn btn-primary btn-sm"><i className="bi bi-plus-lg" /> New product</Link>}
                title={
                    <FilterBar>
                        <div className="col-auto"><input className="form-control form-control-sm" placeholder="Search…" value={f.q} onChange={sel('q')} /></div>
                        <div className="col-auto">
                            <select className="form-select form-select-sm" value={f.category_id} onChange={sel('category_id')}>
                                <option value="">All categories</option>
                                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="col-auto">
                            <select className="form-select form-select-sm" value={f.is_active} onChange={sel('is_active')}>
                                <option value="">Any status</option><option value="1">Active</option><option value="0">Inactive</option>
                            </select>
                        </div>
                        {[['featured', 'Featured'], ['new_arrival', 'New arrivals'], ['low_stock', 'Low stock']].map(([k, l]) => (
                            <div key={k} className="col-auto form-check">
                                <input className="form-check-input" type="checkbox" id={`f-${k}`} checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked ? 1 : '' })} />
                                <label className="form-check-label small" htmlFor={`f-${k}`}>{l}</label>
                            </div>
                        ))}
                    </FilterBar>
                }>
                <DataTable url="/products" columns={columns} filters={f} defaultSort="-id" onRowClick={(p) => navigate(`/products/${p.id}`)} />
            </Card>
        </Page>
    );
}
