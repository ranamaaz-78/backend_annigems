import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import nav, { quickCreate } from '../nav';
import Dropdown from '../components/Dropdown';
import { Icon, Initials, Modal } from '../components/ui';
import { getThemeMode, setThemeMode } from '../theme';

/** Metronic demo10 layout: dark sidebar + rounded content panel. */
export default function AppLayout() {
    const { user, can } = useAuth();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    // demo10 body styling only while the app shell is mounted
    useEffect(() => {
        const cls = ['bg-mono', 'dark:bg-background', 'lg:overflow-hidden'];
        document.body.classList.add(...cls);
        return () => document.body.classList.remove(...cls);
    }, []);

    useEffect(() => setMobileOpen(false), [location.pathname, location.search]);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const items = nav.filter((i) => i.header || can(i.perm));
    const visible = items.filter((i, idx) => !i.header || (items[idx + 1] && !items[idx + 1].header));
    const creates = quickCreate.filter((q) => can(q.perm));

    return (
        <div className="flex grow [--header-height:60px] [--sidebar-width:270px]">
            {/* Mobile header */}
            <header className="flex lg:hidden items-center fixed z-10 top-0 start-0 end-0 shrink-0 bg-mono dark:bg-background h-(--header-height)">
                <div className="kt-container-fluid flex items-center justify-between flex-wrap gap-3">
                    <Link to="/" className="flex items-center gap-2.5">
                        <Logo />
                        <span className="text-white font-medium">AANI GEMAS</span>
                    </Link>
                    <button type="button" className="kt-btn kt-btn-icon kt-btn-dim hover:text-white -me-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                        <Icon name="menu" />
                    </button>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row grow pt-(--header-height) lg:pt-0 min-w-0">
                {mobileOpen && <div className="demo10-overlay" onClick={() => setMobileOpen(false)} />}

                {/* Sidebar */}
                <aside className={`demo10-sidebar ${mobileOpen ? 'open' : ''} flex flex-col fixed top-0 bottom-0 z-20 items-stretch shrink-0 w-(--sidebar-width) dark bg-zinc-950 lg:bg-transparent`}>
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2.5 px-3.5 h-[70px]">
                            <Link to="/"><Logo /></Link>
                            <Dropdown
                                className="grow min-w-0"
                                placement="bottom-start"
                                width="w-56"
                                toggle={(open) => (
                                    <button type="button" className="flex items-center grow justify-between cursor-pointer text-start">
                                        <span className="text-lg font-medium text-inverse grow text-white">AANI GEMAS</span>
                                        <Icon name={open ? 'up' : 'down'} className="text-xs text-muted-foreground" />
                                    </button>
                                )}
                            >
                                <a className="kt-dropdown-menu-link" href={user?.storefront_url || '/'} target="_blank" rel="noreferrer"><Icon name="shop" /> Open storefront</a>
                                <a className="kt-dropdown-menu-link" href="/docs" target="_blank" rel="noreferrer"><Icon name="code" /> API documentation</a>
                                <Link className="kt-dropdown-menu-link" to="/profile"><Icon name="profile-circle" /> My profile</Link>
                            </Dropdown>
                        </div>
                        <div className="flex items-center gap-2.5 px-3.5">
                            {creates.length > 0 ? (
                                <Dropdown
                                    placement="bottom-start"
                                    width="w-[240px]"
                                    toggle={<button type="button" className="kt-btn kt-btn-secondary text-white [&_i]:text-white justify-center min-w-[198px]"><Icon name="plus" /> Add New</button>}
                                >
                                    <div className="px-2.5 pt-1 pb-1.5 text-xs text-muted-foreground uppercase">Create</div>
                                    {creates.map((q) => (
                                        <Link key={q.to} to={q.to} className="kt-dropdown-menu-link"><Icon name={q.icon} /> {q.label}</Link>
                                    ))}
                                </Dropdown>
                            ) : <span className="min-w-[198px]" />}
                            <button type="button" className="kt-btn kt-btn-icon kt-btn-secondary [&_i]:text-white" onClick={() => setSearchOpen(true)} title="Search (Ctrl+K)">
                                <Icon name="magnifier" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-stretch grow justify-center my-5 min-h-0 overflow-hidden">
                        <div className="kt-scrollable-y-auto grow h-full">
                            <nav className="flex flex-col gap-5">
                                {groupByHeader(visible).map((g) => (
                                    <div key={g.header}>
                                        <h3 className="text-sm text-muted-foreground uppercase ps-5 inline-block mb-3">{g.header}</h3>
                                        <div className="kt-menu flex flex-col w-full gap-1.5 px-3.5">
                                            {g.items.map((item) => (item.children ? <TreeItem key={item.label} item={item} pathname={location.pathname} /> : <LeafItem key={item.to} item={item} />))}
                                        </div>
                                    </div>
                                ))}
                            </nav>
                        </div>
                    </div>

                    <div className="flex items-center justify-between shrink-0 ps-4 pe-3.5 mb-3.5">
                        <UserMenu />
                        <div className="flex items-center gap-1.5">
                            {can('messages.manage') && (
                                <Link to="/messages" className="kt-btn kt-btn-ghost kt-btn-icon size-8 hover:bg-background hover:[&_i]:text-primary" title="Messages"><Icon name="messages" /></Link>
                            )}
                            <ThemeToggle />
                        </div>
                    </div>
                </aside>

                {/* Main */}
                <div className="flex flex-col grow min-w-0 lg:rounded-l-xl bg-background border border-input lg:ms-(--sidebar-width)">
                    <div className="flex flex-col grow kt-scrollable-y-auto lg:[--kt-scrollbar-width:auto] pt-5 lg:h-screen">
                        <main className="grow" role="main" key={location.pathname}>
                            <Outlet />
                        </main>
                        <footer className="kt-container-fluid flex flex-col md:flex-row justify-between items-center gap-3 py-5 text-sm text-secondary-foreground">
                            <span>{new Date().getFullYear()} © AANI GEMAS</span>
                            <span>Admin panel · {user?.roles?.join(', ')}</span>
                        </footer>
                    </div>
                </div>
            </div>

            <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
        </div>
    );
}

function Logo() {
    return (
        <span className="flex items-center justify-center size-[34px] rounded-full bg-gradient-to-br from-amber-300 to-yellow-600 shadow ring-2 ring-white/10 overflow-hidden">
            <img src="/storage/images/logo_aani.png" alt="" className="size-6 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </span>
    );
}

function groupByHeader(items) {
    const groups = [];
    items.forEach((i) => {
        if (i.header) groups.push({ header: i.header, items: [] });
        else groups[groups.length - 1]?.items.push(i);
    });
    return groups.filter((g) => g.items.length);
}

const linkCls = 'kt-menu-link gap-2.5 py-2 px-2.5 rounded-md kt-menu-item-active:bg-accent/60 kt-menu-link-hover:bg-accent/60 transition-colors';
const iconCls = 'kt-menu-icon items-start text-lg text-secondary-foreground kt-menu-item-active:text-mono kt-menu-link-hover:text-mono';
const titleCls = 'kt-menu-title text-sm text-foreground font-medium kt-menu-item-active:text-mono kt-menu-link-hover:text-mono';

function LeafItem({ item }) {
    return (
        <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => `kt-menu-item ${isActive ? 'active' : ''}`}>
            <span className={linkCls}>
                <span className={iconCls}><Icon name={item.icon} /></span>
                <span className={titleCls}>{item.label}</span>
            </span>
        </NavLink>
    );
}

function TreeItem({ item, pathname }) {
    const active = item.children.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`));
    const [open, setOpen] = useState(active);
    useEffect(() => {
        if (active) setOpen(true);
    }, [active]);
    return (
        <div className={`kt-menu-item ${open ? 'show' : ''} ${active ? 'here' : ''}`}>
            <button type="button" className="kt-menu-link gap-2.5 py-2 px-2.5 rounded-md w-full text-start kt-menu-link-hover:bg-accent/60 transition-colors" onClick={() => setOpen(!open)}>
                <span className="kt-menu-icon items-start text-muted-foreground text-lg kt-menu-item-here:text-mono kt-menu-item-show:text-mono kt-menu-link-hover:text-mono"><Icon name={item.icon} /></span>
                <span className="kt-menu-title font-medium text-sm text-secondary-foreground kt-menu-item-here:text-mono kt-menu-item-show:text-mono kt-menu-link-hover:text-mono">{item.label}</span>
                <span className="kt-menu-arrow text-muted-foreground kt-menu-item-show:text-foreground">
                    <Icon name="down" className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </span>
            </button>
            <div className="kt-menu-accordion-anim">
                <div>
                    <div className="flex flex-col gap-px ps-7 pt-px">
                        {item.children.map((c) => (
                            <NavLink key={c.to} to={c.to} className={({ isActive }) => `kt-menu-item ${isActive ? 'active' : ''}`}>
                                <span className="kt-menu-link py-2 px-2.5 rounded-md kt-menu-item-active:bg-secondary kt-menu-link-hover:bg-secondary transition-colors">
                                    <span className="kt-menu-title text-sm text-foreground kt-menu-item-active:font-medium kt-menu-item-active:text-mono kt-menu-link-hover:text-mono">{c.label}</span>
                                </span>
                            </NavLink>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function UserMenu() {
    const { user, logout } = useAuth();
    return (
        <Dropdown
            placement="top-start"
            width="w-[250px]"
            toggle={<button type="button" className="cursor-pointer shrink-0 rounded-full"><Initials name={user?.name} className="size-9 text-xs border-2 border-white/25 bg-white/10 text-white" /></button>}
        >
            <div className="flex items-center justify-between px-2.5 py-1.5 gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    <Initials name={user?.name} className="size-9 text-xs border-2 border-green-500" />
                    <div className="flex flex-col gap-1.5 min-w-0">
                        <span className="text-sm text-foreground font-semibold leading-none truncate">{user?.name}</span>
                        <span className="text-xs text-secondary-foreground font-medium leading-none truncate">{user?.email}</span>
                    </div>
                </div>
                <span className="kt-badge kt-badge-sm kt-badge-primary kt-badge-outline shrink-0">{user?.roles?.[0]?.split(' ')[0]}</span>
            </div>
            <div className="kt-dropdown-menu-separator" />
            <Link className="kt-dropdown-menu-link" to="/profile"><Icon name="profile-circle" /> My profile</Link>
            <Link className="kt-dropdown-menu-link" to="/profile"><Icon name="shield-tick" /> Security & 2FA</Link>
            <div className="kt-dropdown-menu-separator" />
            <div className="px-2.5 pb-1">
                <button type="button" className="kt-btn kt-btn-outline justify-center w-full" onClick={logout}><Icon name="exit-right" /> Log out</button>
            </div>
        </Dropdown>
    );
}

function ThemeToggle() {
    const [mode, setMode] = useState(getThemeMode());
    const next = mode === 'dark' ? 'light' : 'dark';
    return (
        <button type="button" className="kt-btn kt-btn-ghost kt-btn-icon size-8 hover:bg-background hover:[&_i]:text-primary" title={`Switch to ${next} mode`} onClick={() => { setThemeMode(next); setMode(next); }}>
            <Icon name={mode === 'dark' ? 'sun' : 'moon'} />
        </button>
    );
}

/** Ctrl/⌘+K command palette: jump to any screen or an order number. */
function SearchPalette({ open, onClose }) {
    const { can } = useAuth();
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const [idx, setIdx] = useState(0);
    useEffect(() => { if (open) { setQ(''); setIdx(0); } }, [open]);

    const entries = useMemo(() => {
        const out = [];
        nav.forEach((n) => {
            if (n.header || !can(n.perm)) return;
            if (n.children) n.children.forEach((c) => out.push({ label: c.label, group: n.label, to: c.to, icon: n.icon }));
            else out.push({ label: n.label, group: 'Pages', to: n.to, icon: n.icon });
        });
        out.push({ label: 'My profile', group: 'Account', to: '/profile', icon: 'profile-circle' });
        return out;
    }, [can]);

    const term = q.trim().toLowerCase();
    let results = entries.filter((e) => !term || `${e.label} ${e.group}`.toLowerCase().includes(term));
    if (/^ag-?\d{3,}$/i.test(term) && can('orders.view')) {
        const num = term.toUpperCase().replace(/^AG-?/, 'AG-');
        results = [{ label: `Open order ${num}`, group: 'Orders', to: `/orders/${num}`, icon: 'handcart' }, ...results];
    } else if (term.includes('@') && can('customers.view')) {
        results = [{ label: `Find orders for ${q.trim()}`, group: 'Orders', to: `/orders?q=${encodeURIComponent(q.trim())}`, icon: 'handcart' }, ...results];
    }
    const go = (r) => { onClose(); navigate(r.to); };

    return (
        <Modal show={open} onClose={onClose} title="Search">
            <div className="kt-input mb-4">
                <Icon name="magnifier" />
                <input
                    autoFocus
                    placeholder="Screens, order number (AG-10001) or customer email…"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setIdx(0); }}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
                        if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
                        if (e.key === 'Enter' && results[idx]) go(results[idx]);
                    }}
                />
                <span className="kt-badge kt-badge-sm kt-badge-outline">Esc</span>
            </div>
            <div className="flex flex-col gap-0.5 max-h-[50vh] overflow-y-auto">
                {results.slice(0, 30).map((r, i) => (
                    <button type="button" key={`${r.to}-${i}`} onMouseEnter={() => setIdx(i)} onClick={() => go(r)}
                        className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-start transition-colors ${i === idx ? 'bg-accent' : ''}`}>
                        <span className="flex items-center justify-center size-8 rounded-md border border-border bg-background"><Icon name={r.icon} className="text-base text-muted-foreground" /></span>
                        <span className="flex flex-col">
                            <span className="text-sm text-mono font-medium">{r.label}</span>
                            <span className="text-xs text-secondary-foreground">{r.group}</span>
                        </span>
                        {i === idx && <Icon name="arrow-right" className="ms-auto text-muted-foreground" />}
                    </button>
                ))}
                {!results.length && <div className="text-sm text-secondary-foreground p-3">No matches.</div>}
            </div>
        </Modal>
    );
}
