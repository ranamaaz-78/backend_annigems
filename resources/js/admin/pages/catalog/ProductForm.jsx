import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../../api';
import { Alert, Card, Page, Spinner, useFlash } from '../../components/ui';
import { Check, Input, MoneyInput, Select, StringList, Textarea } from '../../components/form';
import SortableImages from '../../components/SortableImages';

const EMPTY = {
    category_id: '', name: '', slug: '', legacy_id: '', sku: '', subtitle: '', description: '', price: 0, compare_at_price: null, badge: '',
    metal: '18K Gold', stone: '', weight: '', details: [], tags: [], rating: 0, reviews_count: 0, has_sizes: false, sizes: [],
    stock_qty: 0, track_stock: true, is_customizable: false, is_featured: false, featured_sort: 0, is_new_arrival: false, new_arrival_sort: 0,
    is_active: true, published_at: '', images: [],
};

export default function ProductForm() {
    const { id } = useParams();
    const isNew = id === 'new';
    const navigate = useNavigate();
    const [p, setP] = useState(isNew ? EMPTY : null);
    const [cats, setCats] = useState([]);
    const [opts, setOpts] = useState({ badges: [], default_sizes: [] });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useFlash();
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        api.get('/categories', { params: { all: 1 } }).then(({ data }) => setCats(data.data));
        api.get('/products-options').then(({ data }) => setOpts(data.data));
        if (!isNew) {
            api.get(`/products/${id}`).then(({ data }) => setP({ ...data.data, images: data.data.images.map((i) => ({ path: i.path, alt: i.alt })), published_at: data.data.published_at?.slice(0, 16) || '' }))
                .catch((e) => setLoadError(errorMessage(e)));
        }
    }, [id, isNew]);

    if (loadError) return <Page title="Product"><Alert>{loadError}</Alert></Page>;
    if (!p) return <Page title="Product"><Spinner /></Page>;

    const b = (k) => ({ value: p[k], onChange: (v) => setP({ ...p, [k]: v }), error: errors[k] });
    const sizes = opts.default_sizes;

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});
        const body = { ...p, badge: p.badge || null, slug: p.slug || null, legacy_id: p.legacy_id || null, sku: p.sku || null, published_at: p.published_at || null };
        try {
            const { data } = isNew ? await api.post('/products', body) : await api.put(`/products/${id}`, body);
            setFlash('Product saved.');
            if (isNew) navigate(`/products/${data.data.id}`, { replace: true });
            else setP({ ...data.data, images: data.data.images.map((i) => ({ path: i.path, alt: i.alt })), published_at: data.data.published_at?.slice(0, 16) || '' });
        } catch (err) {
            setErrors(fieldErrors(err));
            setFlash(errorMessage(err), 'danger');
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!window.confirm('Delete this product? Existing orders keep their snapshot.')) return;
        await api.delete(`/products/${id}`);
        navigate('/products');
    };

    return (
        <Page title={isNew ? 'New product' : p.name} crumbs={[{ label: 'Products', to: '/products' }, { label: isNew ? 'New' : p.name }]}>
            {flash}
            <form onSubmit={save}>
                <div className="row">
                    <div className="col-lg-8">
                        <Card title="Details" outline="primary">
                            <div className="row">
                                <div className="col-md-8"><Input label="Name *" {...b('name')} /></div>
                                <div className="col-md-4"><Select label="Category *" {...b('category_id')} options={cats.map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose…" /></div>
                                <div className="col-md-12"><Input label="Subtitle" {...b('subtitle')} /></div>
                                <div className="col-md-4"><Input label="Slug" {...b('slug')} help="Leave empty to generate from the name." /></div>
                                <div className="col-md-4"><Input label="Legacy id" {...b('legacy_id')} help="Storefront id (r1, n1…)." /></div>
                                <div className="col-md-4"><Input label="SKU" {...b('sku')} /></div>
                                <div className="col-12"><Textarea label="Description" rows={4} {...b('description')} /></div>
                                <div className="col-md-4"><Input label="Metal" {...b('metal')} /></div>
                                <div className="col-md-4"><Input label="Stone" {...b('stone')} help="Used by the stone filter (Diamond, Ruby…)." /></div>
                                <div className="col-md-4"><Input label="Weight" {...b('weight')} /></div>
                            </div>
                        </Card>
                        <Card title="Images">
                            <SortableImages value={p.images} onChange={(v) => setP({ ...p, images: v })} />
                        </Card>
                        <div className="row">
                            <div className="col-md-6"><Card title="Details list"><StringList {...b('details')} placeholder="Add detail" /></Card></div>
                            <div className="col-md-6"><Card title="Tags"><StringList {...b('tags')} placeholder="Add tag" /></Card></div>
                        </div>
                        <Card title="Sizes">
                            <Check label="This product requires a size (ring sizes)" checked={p.has_sizes} onChange={(v) => setP({ ...p, has_sizes: v, sizes: v && !p.sizes?.length ? sizes : p.sizes })} id="has-sizes" />
                            {p.has_sizes && (
                                <div className="d-flex flex-wrap gap-1">
                                    {[...new Set([...sizes, ...(p.sizes || [])])].sort((a, c) => parseFloat(a) - parseFloat(c)).map((s) => {
                                        const on = (p.sizes || []).includes(s);
                                        return (
                                            <button type="button" key={s} className={`btn btn-sm ${on ? 'btn-primary' : 'btn-outline-secondary'}`}
                                                onClick={() => setP({ ...p, sizes: on ? p.sizes.filter((x) => x !== s) : [...(p.sizes || []), s].sort((a, c) => parseFloat(a) - parseFloat(c)) })}>{s}</button>
                                        );
                                    })}
                                </div>
                            )}
                            {errors.sizes && <div className="text-danger small">{errors.sizes}</div>}
                        </Card>
                    </div>
                    <div className="col-lg-4">
                        <Card title="Publish">
                            <Check label="Active (visible on the storefront)" checked={p.is_active} onChange={(v) => setP({ ...p, is_active: v })} id="active" />
                            <Input label="Published at" type="datetime-local" {...b('published_at')} help="Empty = now." />
                            <div className="d-flex gap-2">
                                <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                                {!isNew && <button type="button" className="btn btn-outline-danger" onClick={remove}>Delete</button>}
                            </div>
                        </Card>
                        <Card title="Pricing (EUR)">
                            <MoneyInput label="Price *" {...b('price')} />
                            <MoneyInput label="Compare-at price" {...b('compare_at_price')} nullable help="Shown crossed out (Sale)." />
                            <Select label="Badge" {...b('badge')} options={opts.badges} placeholder="None" />
                        </Card>
                        <Card title="Stock">
                            <Check label="Track stock" checked={p.track_stock} onChange={(v) => setP({ ...p, track_stock: v })} id="track" />
                            <Input label="Stock quantity" type="number" {...b('stock_qty')} />
                        </Card>
                        <Card title="Merchandising">
                            <Check label="Featured on home" checked={p.is_featured} onChange={(v) => setP({ ...p, is_featured: v })} id="feat" />
                            {p.is_featured && <Input label="Featured order" type="number" {...b('featured_sort')} />}
                            <Check label="New arrival" checked={p.is_new_arrival} onChange={(v) => setP({ ...p, is_new_arrival: v })} id="newa" />
                            {p.is_new_arrival && <Input label="New-arrival order" type="number" {...b('new_arrival_sort')} />}
                            <Check label='Customizable (shows "Design Your Ring" link)' checked={p.is_customizable} onChange={(v) => setP({ ...p, is_customizable: v })} id="cust" />
                            <div className="row">
                                <div className="col-6"><Input label="Rating" type="number" step="0.1" {...b('rating')} /></div>
                                <div className="col-6"><Input label="Reviews count" type="number" {...b('reviews_count')} /></div>
                            </div>
                        </Card>
                    </div>
                </div>
            </form>
        </Page>
    );
}
