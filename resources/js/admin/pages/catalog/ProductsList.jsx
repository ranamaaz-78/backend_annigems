import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import DataTable, { FilterBar, SearchInput } from '../../components/DataTable';
import { ActiveBadge, Icon, Page, eur } from '../../components/ui';

export default function ProductsList() {
    const navigate = useNavigate();
    const [cats, setCats] = useState([]);
    const [f, setF] = useState({ q: '', category_id: '', is_active: '', featured: '', new_arrival: '', low_stock: '' });
    useEffect(() => { api.get('/categories', { params: { all: 1 } }).then(({ data }) => setCats(data.data)); }, []);

    const columns = [
        { key: 'name', label: 'Product', sortable: true, render: (p) => (
            <div className="flex items-center gap-3">
                {p.image_url ? <img src={p.image_url} alt="" className="size-11 rounded-lg object-cover border border-border shrink-0" /> : <span className="size-11 rounded-lg bg-muted shrink-0" />}
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-mono">{p.name}</span>
                    <span className="text-xs text-secondary-foreground">{p.legacy_id && <span className="kt-badge kt-badge-sm kt-badge-outline me-1">{p.legacy_id}</span>}{p.category?.name}</span>
                </div>
            </div>
        ) },
        { key: 'price', label: 'Price', sortable: true, className: 'text-end', render: (p) => (
            <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-mono">{eur(p.price)}</span>
                {p.compare_at_price && <span className="text-xs text-muted-foreground line-through">{eur(p.compare_at_price)}</span>}
            </div>
        ) },
        { key: 'stock_qty', label: 'Stock', sortable: true, className: 'text-center', render: (p) => (p.track_stock
            ? <span className={`kt-badge kt-badge-sm ${p.stock_qty <= 0 ? 'kt-badge-destructive' : p.stock_qty <= 3 ? 'kt-badge-warning' : 'kt-badge-success kt-badge-outline'}`}>{p.stock_qty}</span>
            : <span className="text-xs text-muted-foreground">not tracked</span>) },
        { key: 'rating', label: 'Rating', sortable: true, render: (p) => <span className="flex items-center gap-1 text-sm"><Icon name="star" className="text-yellow-500" />{p.rating} <span className="text-xs text-muted-foreground">({p.reviews_count})</span></span> },
        { key: 'flags', label: 'Flags', render: (p) => (
            <div className="flex flex-wrap gap-1">
                {p.badge && <span className="kt-badge kt-badge-sm kt-badge-info kt-badge-outline">{p.badge}</span>}
                {p.is_featured && <span className="kt-badge kt-badge-sm kt-badge-primary kt-badge-outline">Featured #{p.featured_sort}</span>}
                {p.is_new_arrival && <span className="kt-badge kt-badge-sm kt-badge-success kt-badge-outline">New #{p.new_arrival_sort}</span>}
                {p.is_customizable && <span className="kt-badge kt-badge-sm kt-badge-warning kt-badge-outline">Customizable</span>}
            </div>
        ) },
        { key: 'is_active', label: 'Status', render: (p) => <ActiveBadge active={p.is_active} /> },
    ];
    const sel = (k) => (e) => setF({ ...f, [k]: e.target.value });
    const toggle = (k) => setF({ ...f, [k]: f[k] ? '' : 1 });

    return (
        <Page title="Products" crumbs={[{ label: 'Catalog' }, { label: 'Products' }]} actions={<Link to="/products/new" className="kt-btn kt-btn-primary"><Icon name="plus" /> New product</Link>}>
            <div className="kt-card kt-card-grid min-w-full">
                <div className="kt-card-header py-3 flex-wrap gap-3">
                    <FilterBar>
                        <SearchInput value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Search products" />
                        <select className="kt-select w-44" value={f.category_id} onChange={sel('category_id')}>
                            <option value="">All categories</option>
                            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select className="kt-select w-36" value={f.is_active} onChange={sel('is_active')}>
                            <option value="">Any status</option><option value="1">Active</option><option value="0">Inactive</option>
                        </select>
                    </FilterBar>
                    <div className="flex gap-1.5">
                        {[['featured', 'Featured', 'star'], ['new_arrival', 'New', 'rocket'], ['low_stock', 'Low stock', 'information-4']].map(([k, l, i]) => (
                            <button key={k} type="button" className={`kt-btn kt-btn-sm ${f[k] ? 'kt-btn-primary' : 'kt-btn-outline'}`} onClick={() => toggle(k)}><Icon name={i} /> {l}</button>
                        ))}
                    </div>
                </div>
                <div className="kt-card-table">
                    <DataTable url="/products" columns={columns} filters={f} defaultSort="-id" onRowClick={(p) => navigate(`/products/${p.id}`)} empty="No products found." />
                </div>
            </div>
        </Page>
    );
}
