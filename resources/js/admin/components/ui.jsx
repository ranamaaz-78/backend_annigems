import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

/** Keenicons (filled set, as in Metronic demo10). */
export function Icon({ name, className = '' }) {
    return <i className={`ki-filled ki-${name} ${className}`} aria-hidden="true" />;
}

/** Metronic demo10 page toolbar: title + breadcrumb on the left, actions on the right. */
export function PageHeader({ title, crumbs = [], actions }) {
    return (
        <div className="pb-5">
            <div className="kt-container-fluid flex items-center justify-between flex-wrap gap-3">
                <div className="flex flex-col flex-wrap gap-1">
                    <h1 className="font-medium text-lg text-mono">{title}</h1>
                    <div className="flex items-center flex-wrap gap-1 text-sm font-normal">
                        <Link to="/" className="text-secondary-foreground hover:text-primary transition-colors">Home</Link>
                        {crumbs.map((c, i) => (
                            <span key={i} className="flex items-center gap-1">
                                <span className="text-muted-foreground text-xs">/</span>
                                {c.to ? (
                                    <Link to={c.to} className="text-secondary-foreground hover:text-primary transition-colors">{c.label}</Link>
                                ) : (
                                    <span className="text-mono">{c.label}</span>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
                {actions && <div className="flex items-center flex-wrap gap-1.5 lg:gap-2.5">{actions}</div>}
            </div>
        </div>
    );
}

export function Page({ title, crumbs, actions, children }) {
    return (
        <div className="page-enter">
            <PageHeader title={title} crumbs={crumbs} actions={actions} />
            <div className="kt-container-fluid pb-7.5">
                <div className="grid gap-5 lg:gap-7.5">{children}</div>
            </div>
        </div>
    );
}

/** kt-card. `noBody` renders children directly (tables use kt-card-table). */
export function Card({ title, tools, children, footer, className = '', bodyClass = '', noBody, description }) {
    return (
        <div className={`kt-card ${className}`}>
            {(title || tools) && (
                <div className="kt-card-header">
                    <div className="flex flex-col gap-0.5">
                        {title && <h3 className="kt-card-title">{title}</h3>}
                        {description && <div className="kt-card-description text-sm text-secondary-foreground">{description}</div>}
                    </div>
                    {tools && <div className="kt-card-toolbar flex items-center gap-2.5">{tools}</div>}
                </div>
            )}
            {noBody ? <div className="kt-card-table">{children}</div> : <div className={`kt-card-content ${bodyClass}`}>{children}</div>}
            {footer && <div className="kt-card-footer">{footer}</div>}
        </div>
    );
}

const TONES = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-green-500/10 text-green-600 border-green-500/20',
    info: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    warning: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    danger: 'bg-destructive/10 text-destructive border-destructive/20',
    secondary: 'bg-muted text-secondary-foreground border-border',
    dark: 'bg-mono/10 text-mono border-mono/20',
};

/** KPI card (Metronic "highlights" style). */
export function StatCard({ value, label, icon, color = 'primary', to, hint }) {
    const body = (
        <div className="kt-card hover-lift h-full">
            <div className="kt-card-content flex items-center gap-4">
                <span className={`flex items-center justify-center size-12 shrink-0 rounded-xl border ${TONES[color] || TONES.primary}`}>
                    <Icon name={icon} className="text-2xl" />
                </span>
                <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-2xl font-semibold text-mono leading-none truncate">{value}</span>
                    <span className="text-sm text-secondary-foreground">{label}</span>
                    {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
                </div>
                {to && <Icon name="right" className="ms-auto text-muted-foreground" />}
            </div>
        </div>
    );
    return to ? <Link to={to} className="block">{body}</Link> : body;
}
export const SmallBox = StatCard;

const ALERT = { info: 'kt-alert-info', warning: 'kt-alert-warning', danger: 'kt-alert-destructive', success: 'kt-alert-success', primary: 'kt-alert-primary', secondary: 'kt-alert-mono' };
const ALERT_ICON = { info: 'information-2', warning: 'information-4', danger: 'shield-cross', success: 'check-circle', primary: 'information-2', secondary: 'information-2' };

export function Callout({ type = 'info', title, children }) {
    return (
        <div className={`kt-alert kt-alert-light ${ALERT[type] || ALERT.info}`} role="alert">
            <div className="kt-alert-icon"><Icon name={ALERT_ICON[type] || 'information-2'} /></div>
            <div className="kt-alert-content">
                {title && <div className="kt-alert-title">{title}</div>}
                <div className="kt-alert-description text-sm">{children}</div>
            </div>
        </div>
    );
}

export function Alert({ type = 'danger', children, onClose }) {
    if (!children) return null;
    return (
        <div className={`kt-alert kt-alert-light ${ALERT[type] || ALERT.danger}`} role="alert">
            <div className="kt-alert-icon"><Icon name={ALERT_ICON[type] || 'information-2'} /></div>
            <div className="kt-alert-title text-sm font-normal">{children}</div>
            {onClose && (
                <div className="kt-alert-toolbar">
                    <button type="button" className="kt-alert-close" onClick={onClose} aria-label="Close"><Icon name="cross" /></button>
                </div>
            )}
        </div>
    );
}

const BADGE = {
    pending_payment: 'warning', paid: 'success', payment_failed: 'destructive', cancelled: 'secondary',
    refunded: 'mono', partially_refunded: 'info', placed: 'primary', crafting: 'info',
    quality_check: 'warning', shipped: 'primary', delivered: 'success', new: 'destructive', read: 'secondary', replied: 'success',
    active: 'success', inactive: 'secondary', api: 'info', manual: 'secondary',
};

export function Badge({ color = 'secondary', children, appearance = 'outline', size = '', dot }) {
    return (
        <span className={`kt-badge ${size ? `kt-badge-${size}` : ''} kt-badge-${color} ${appearance === 'outline' ? 'kt-badge-outline' : appearance === 'light' ? 'kt-badge-light' : ''}`}>
            {dot && <span className="kt-badge-dot size-1.5" />}
            {children}
        </span>
    );
}

export function StatusBadge({ value, label }) {
    if (value === null || value === undefined) return null;
    return <Badge color={BADGE[value] || 'secondary'} dot>{label || String(value).replace(/_/g, ' ')}</Badge>;
}

export function ActiveBadge({ active }) {
    return <StatusBadge value={active ? 'active' : 'inactive'} />;
}

export function Spinner({ text = 'Loading…', className = '' }) {
    return (
        <div className={`flex items-center gap-2.5 text-sm text-secondary-foreground p-5 ${className}`}>
            <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>{text}</span>
        </div>
    );
}

/** Skeleton placeholder block. */
export function Skeleton({ className = 'h-4 w-full' }) {
    return <div className={`kt-shimmer rounded-md ${className}`} />;
}

/** Toast notifications (Metronic style), rendered bottom-right. */
export function useFlash() {
    const [flash, setFlash] = useState(null);
    useEffect(() => {
        if (!flash) return undefined;
        const t = setTimeout(() => setFlash(null), 4200);
        return () => clearTimeout(t);
    }, [flash]);
    const node = flash ? <Toast type={flash.type} onClose={() => setFlash(null)}>{flash.text}</Toast> : null;
    return [node, (text, type = 'success') => setFlash({ text, type, at: Date.now() })];
}

function Toast({ type = 'success', children, onClose }) {
    return createPortal(
        <div className="fixed z-[100] bottom-5 end-5 max-w-[380px] w-[calc(100%-2.5rem)] kt-toast-anim">
            <div className={`kt-alert ${type === 'danger' ? 'kt-alert-destructive' : type === 'warning' ? 'kt-alert-warning' : 'kt-alert-mono'} shadow-lg`} role="status">
                <div className="kt-alert-icon"><Icon name={type === 'danger' ? 'shield-cross' : type === 'warning' ? 'information-4' : 'check-circle'} /></div>
                <div className="kt-alert-title text-sm font-normal">{children}</div>
                <div className="kt-alert-toolbar">
                    <button type="button" className="kt-alert-close" onClick={onClose} aria-label="Close"><Icon name="cross" /></button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

const MODAL_SIZES = { sm: 'max-w-[400px]', '': 'max-w-[560px]', lg: 'max-w-[800px]', xl: 'max-w-[1100px]' };

/** kt-modal with backdrop, enter animation and Escape to close. */
export function Modal({ title, show, onClose, children, footer, size = '' }) {
    useEffect(() => {
        if (!show) return undefined;
        const onKey = (e) => e.key === 'Escape' && onClose?.();
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [show, onClose]);
    if (!show) return null;
    return createPortal(
        <div className="kt-modal open z-50 flex items-start justify-center" role="dialog" aria-modal="true">
            <div className="kt-modal-backdrop kt-modal-backdrop-anim" onClick={onClose} />
            <div className={`kt-modal-content relative w-full ${MODAL_SIZES[size] ?? MODAL_SIZES['']} mt-[6vh] mb-10 max-h-[88vh]`}>
                <div className="kt-modal-header">
                    <h3 className="kt-modal-title">{title}</h3>
                    <button type="button" className="kt-modal-close" onClick={onClose} aria-label="Close"><Icon name="cross" /></button>
                </div>
                <div className="kt-modal-body grow overflow-y-auto">{children}</div>
                {footer && <div className="kt-modal-footer flex justify-end gap-2.5">{footer}</div>}
            </div>
        </div>,
        document.body,
    );
}

/** Empty state with a Metronic illustration. */
export function EmptyState({ title = 'Nothing here yet', text, action, illustration = '22' }) {
    return (
        <div className="flex flex-col items-center text-center gap-3 py-10 px-5">
            <img src={`/admin-assets/media/${illustration}.svg`} alt="" className="dark:hidden max-h-[140px]" />
            <img src={`/admin-assets/media/${illustration}-dark.svg`} alt="" className="light:hidden max-h-[140px]" />
            <h3 className="text-base font-semibold text-mono">{title}</h3>
            {text && <p className="text-sm text-secondary-foreground max-w-md">{text}</p>}
            {action}
        </div>
    );
}

/** Small key/value row used in detail cards. */
export function Row({ label, children, className = '' }) {
    return (
        <div className={`flex items-start justify-between gap-4 py-1.5 text-sm ${className}`}>
            <span className="text-secondary-foreground">{label}</span>
            <span className="text-mono text-end">{children}</span>
        </div>
    );
}

export function formatDate(iso, withTime = true) {
    if (!iso) return '—';
    const d = new Date(iso);
    return withTime
        ? d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Money object from the API: {amount, currency, formatted}. */
export function Money({ value }) {
    if (!value) return '—';
    return <span className="whitespace-nowrap">{value.formatted}</span>;
}

export function eur(minor) {
    if (minor === null || minor === undefined || minor === '') return '—';
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(minor / 100);
}

/** Avatar with initials. */
export function Initials({ name = '', className = 'size-9 text-xs' }) {
    const ini = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    return <span className={`inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold border border-primary/20 shrink-0 ${className}`}>{ini}</span>;
}

/** Metronic line tabs. tabs: [{value, label, icon?, count?}] */
export function Tabs({ tabs, value, onChange, className = '' }) {
    return (
        <div className={`kt-tabs kt-tabs-line flex-wrap gap-5 ${className}`}>
            {tabs.map((t) => (
                <button key={t.value} type="button" data-kt-tab-toggle="" className={`kt-tab-toggle py-3 transition-colors ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
                    {t.icon && <Icon name={t.icon} />}
                    {t.label}
                    {t.count !== undefined && <span className="kt-badge kt-badge-sm kt-badge-outline">{t.count}</span>}
                </button>
            ))}
        </div>
    );
}
