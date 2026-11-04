import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../../api';
import { Alert, Card, Icon, Page, Spinner, useFlash } from '../../components/ui';
import { Check, Input, MoneyInput, Select, StringList, Textarea } from '../../components/form';
import SortableImages from '../../components/SortableImages';

const EMPTY = {
    category_id: '', name: '', slug: '', legacy_id: '', sku: '', subtitle: '', description: '', price: 0, compare_at_price: null, badge: '',
    metal: '18K Gold', stone: '', weight: '', details: [], tags: [], rating: 0, reviews_count: 0, has_sizes: false, sizes: [],
    stock_qty: 0, track_stock: true, is_customizable: false, is_featured: false, featured_sort: 0, is_new_arrival: false, new_arrival_sort: 0,
    is_active: true, published_at: '', images: [],
};

const fromApi = (d) => ({ ...d, images: d.images.map((i) => ({ path: i.path, alt: i.alt })), published_at: d.published_at?.slice(0, 16) || '' });

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
        if (!isNew) api.get(`/products/${id}`).then(({ data }) => setP(fromApi(data.data))).catch((e) => setLoadError(errorMessage(e)));
        else setP(EMPTY);
    }, [id, isNew]);

    if (loadError) return <Page title="Product" crumbs={[{ label: 'Products', to: '/products' }]}><Alert>{loadError}</Alert></Page>;
    if (!p) return <Page title="Product" crumbs={[{ label: 'Products', to: '/products' }]}><Spinner /></Page>;

    const b = (k) => ({ value: p[k], onChange: (v) => setP({ ...p, [k]: v }), error: errors[k] });
    const sizes = opts.default_sizes;

    const save = async (e) => {
        e?.preventDefault();
        setSaving(true);
        setErrors({});
        const body = { ...p, badge: p.badge || null, slug: p.slug || null, legacy_id: p.legacy_id || null, sku: p.sku || null, published_at: p.published_at || null };
        try {
            const { data } = isNew ? await api.post('/products', body) : await api.put(`/products/${id}`, body);
            setFlash('Product saved.');
            if (isNew) navigate(`/products/${data.data.id}`, { replace: true });
            else setP(fromApi(data.data));
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
        <Page
            title={isNew ? 'New product' : p.name}
            crumbs={[{ label: 'Catalog' }, { label: 'Products', to: '/products' }, { label: isNew ? 'New' : p.name }]}
            actions={<>
                {!isNew && <a className="kt-btn kt-btn-outline" href={`/api/v1/web/products/${p.slug}`} target="_blank" rel="noreferrer"><Icon name="eye" /> API preview</a>}
                {!isNew && <button type="button" className="kt-btn kt-btn-outline text-destructive" onClick={remove}><Icon name="trash" /> Delete</button>}
                <button type="button" className="kt-btn kt-btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : <><Icon name="check" /> Save product</>}</button>
            </>}
        >
            {flash}
            <form onSubmit={save} className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-start">
                <div className="lg:col-span-2 grid gap-5 lg:gap-7.5">
                    <Card title="General" description="Name, category and description shown on the storefront">
                        <div className="grid md:grid-cols-3 gap-x-5">
                            <Input className="mb-4 md:col-span-2" label="Name *" {...b('name')} />
                            <Select label="Category *" {...b('category_id')} options={cats.map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose…" />
                            <Input className="mb-4 md:col-span-3" label="Subtitle" {...b('subtitle')} />
                            <Input label="Slug" {...b('slug')} help="Empty = generated from the name." />
                            <Input label="Legacy id" {...b('legacy_id')} help="Storefront id (r1, n1…)." />
                            <Input label="SKU" {...b('sku')} />
                            <Textarea className="mb-4 md:col-span-3" label="Description" rows={4} {...b('description')} />
                            <Input label="Metal" {...b('metal')} />
                            <Input label="Stone" {...b('stone')} help="Used by the stone filter." />
                            <Input label="Weight" {...b('weight')} />
                        </div>
                    </Card>
                    <Card title="Media" description="Gallery images">
                        <SortableImages value={p.images} onChange={(v) => setP({ ...p, images: v })} />
                    </Card>
                    <div className="grid md:grid-cols-2 gap-5 lg:gap-7.5">
                        <Card title="Details"><StringList {...b('details')} placeholder="Add detail" /></Card>
                        <Card title="Tags"><StringList {...b('tags')} placeholder="Add tag" /></Card>
                    </div>
                    <Card title="Sizes">
                        <Check label="This product requires a size" description="Customers must choose a ring size before adding to bag." checked={p.has_sizes} onChange={(v) => setP({ ...p, has_sizes: v, sizes: v && !p.sizes?.length ? sizes : p.sizes })} />
                        {p.has_sizes && (
                            <div className="flex flex-wrap gap-1.5">
                                {[...new Set([...sizes, ...(p.sizes || [])])].sort((a, c) => parseFloat(a) - parseFloat(c)).map((s) => {
                                    const on = (p.sizes || []).includes(s);
                                    return (
                                        <button type="button" key={s} className={`kt-btn kt-btn-sm min-w-11 justify-center ${on ? 'kt-btn-primary' : 'kt-btn-outline'}`}
                                            onClick={() => setP({ ...p, sizes: on ? p.sizes.filter((x) => x !== s) : [...(p.sizes || []), s].sort((a, c) => parseFloat(a) - parseFloat(c)) })}>{s}</button>
                                    );
                                })}
                            </div>
                        )}
                        {errors.sizes && <div className="text-xs text-destructive mt-2">{errors.sizes}</div>}
                    </Card>
                </div>
                <div className="grid gap-5 lg:gap-7.5">
                    <Card title="Status">
                        <Check label="Active" description="Visible on the storefront" checked={p.is_active} onChange={(v) => setP({ ...p, is_active: v })} />
                        <Input label="Published at" type="datetime-local" {...b('published_at')} help="Empty = now." />
                    </Card>
                    <Card title="Pricing" description="EUR, converted per currency">
                        <MoneyInput label="Price *" {...b('price')} />
                        <MoneyInput label="Compare-at price" {...b('compare_at_price')} nullable help="Shown crossed out (Sale)." />
                        <Select label="Badge" {...b('badge')} options={opts.badges} placeholder="None" />
                    </Card>
                    <Card title="Inventory">
                        <Check label="Track stock" checked={p.track_stock} onChange={(v) => setP({ ...p, track_stock: v })} />
                        <Input label="Stock quantity" type="number" {...b('stock_qty')} />
                    </Card>
                    <Card title="Merchandising">
                        <Check label="Featured on home" checked={p.is_featured} onChange={(v) => setP({ ...p, is_featured: v })} />
                        {p.is_featured && <Input label="Featured order" type="number" {...b('featured_sort')} />}
                        <Check label="New arrival" checked={p.is_new_arrival} onChange={(v) => setP({ ...p, is_new_arrival: v })} />
                        {p.is_new_arrival && <Input label="New-arrival order" type="number" {...b('new_arrival_sort')} />}
                        <Check label="Customizable" description='Shows the "Design Your Ring" link' checked={p.is_customizable} onChange={(v) => setP({ ...p, is_customizable: v })} />
                        <div className="grid grid-cols-2 gap-x-4">
                            <Input label="Rating" type="number" step="0.1" {...b('rating')} />
                            <Input label="Reviews count" type="number" {...b('reviews_count')} />
                        </div>
                    </Card>
                </div>
                <button type="submit" className="hidden" />
            </form>
        </Page>
    );
}
