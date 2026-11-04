import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/** AdminLTE content header with title + breadcrumbs. */
export function PageHeader({ title, crumbs = [], actions }) {
    return (
        <div className="app-content-header">
            <div className="container-fluid">
                <div className="row align-items-center">
                    <div className="col-sm-6">
                        <h1 className="mb-0 fs-3">{title}</h1>
                    </div>
                    <div className="col-sm-6">
                        <ol className="breadcrumb float-sm-end mb-0">
                            <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                            {crumbs.map((c, i) => (
                                <li key={i} className={`breadcrumb-item ${c.to ? '' : 'active'}`}>
                                    {c.to ? <Link to={c.to}>{c.label}</Link> : c.label}
                                </li>
                            ))}
                            {!crumbs.length && <li className="breadcrumb-item active">{title}</li>}
                        </ol>
                    </div>
                </div>
                {actions && <div className="mt-2 d-flex gap-2 flex-wrap">{actions}</div>}
            </div>
        </div>
    );
}

export function Page({ title, crumbs, actions, children }) {
    return (
        <>
            <PageHeader title={title} crumbs={crumbs} actions={actions} />
            <div className="app-content">
                <div className="container-fluid">{children}</div>
            </div>
        </>
    );
}

export function Card({ title, tools, children, footer, className = '', outline, bodyClass = '', noBody }) {
    return (
        <div className={`card mb-4 ${outline ? `card-outline card-${outline}` : ''} ${className}`}>
            {(title || tools) && (
                <div className="card-header">
                    {title && <h3 className="card-title">{title}</h3>}
                    {tools && <div className="card-tools">{tools}</div>}
                </div>
            )}
            {noBody ? children : <div className={`card-body ${bodyClass}`}>{children}</div>}
            {footer && <div className="card-footer">{footer}</div>}
        </div>
    );
}

export function SmallBox({ value, label, icon, color = 'primary', to }) {
    return (
        <div className={`small-box text-bg-${color}`}>
            <div className="inner">
                <h3>{value}</h3>
                <p>{label}</p>
            </div>
            <i className={`small-box-icon bi ${icon}`} style={{ fontSize: '4rem' }} aria-hidden="true" />
            {to && (
                <Link to={to} className="small-box-footer link-light link-underline-opacity-0 link-underline-opacity-50-hover">
                    More info <i className="bi bi-link-45deg" />
                </Link>
            )}
        </div>
    );
}

export function Callout({ type = 'info', title, children }) {
    return (
        <div className={`callout callout-${type} mb-3`}>
            {title && <h5>{title}</h5>}
            {children}
        </div>
    );
}

const BADGE_COLORS = {
    pending_payment: 'warning', paid: 'success', payment_failed: 'danger', cancelled: 'secondary',
    refunded: 'dark', partially_refunded: 'info', placed: 'primary', crafting: 'info',
    quality_check: 'warning', shipped: 'primary', delivered: 'success', new: 'danger', read: 'secondary', replied: 'success',
    active: 'success', inactive: 'secondary', api: 'info', manual: 'secondary',
};

export function StatusBadge({ value, label }) {
    if (value === null || value === undefined) return null;
    const color = BADGE_COLORS[value] || 'secondary';
    return <span className={`badge text-bg-${color}`}>{label || String(value).replace(/_/g, ' ')}</span>;
}

export function ActiveBadge({ active }) {
    return <StatusBadge value={active ? 'active' : 'inactive'} />;
}

export function Spinner({ text = 'Loading…' }) {
    return (
        <div className="d-flex align-items-center gap-2 text-secondary p-3">
            <div className="spinner-border spinner-border-sm" role="status" />
            <span>{text}</span>
        </div>
    );
}

export function Alert({ type = 'danger', children, onClose }) {
    if (!children) return null;
    return (
        <div className={`alert alert-${type} ${onClose ? 'alert-dismissible' : ''}`} role="alert">
            {children}
            {onClose && <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />}
        </div>
    );
}

/** Self-dismissing flash message. */
export function useFlash() {
    const [flash, setFlash] = useState(null);
    useEffect(() => {
        if (!flash) return undefined;
        const t = setTimeout(() => setFlash(null), 4000);
        return () => clearTimeout(t);
    }, [flash]);
    const node = flash ? <Alert type={flash.type || 'success'} onClose={() => setFlash(null)}>{flash.text}</Alert> : null;
    return [node, (text, type = 'success') => setFlash({ text, type })];
}

export function Modal({ title, show, onClose, children, footer, size = '' }) {
    if (!show) return null;
    return (
        <>
            <div className="modal fade show d-block" tabIndex="-1" role="dialog" onClick={onClose}>
                <div className={`modal-dialog modal-dialog-scrollable ${size ? `modal-${size}` : ''}`} onClick={(e) => e.stopPropagation()}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">{title}</h5>
                            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
                        </div>
                        <div className="modal-body">{children}</div>
                        {footer && <div className="modal-footer">{footer}</div>}
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show" />
        </>
    );
}

export function formatDate(iso, withTime = true) {
    if (!iso) return '—';
    const d = new Date(iso);
    return withTime ? d.toLocaleString() : d.toLocaleDateString();
}

/** Money object from the API: {amount, currency, formatted}. */
export function Money({ value }) {
    if (!value) return '—';
    return <span className="text-nowrap">{value.formatted}</span>;
}

export function eur(minor) {
    if (minor === null || minor === undefined || minor === '') return '—';
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(minor / 100);
}
