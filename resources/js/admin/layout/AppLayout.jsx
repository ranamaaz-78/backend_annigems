import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import nav from '../nav';

const LG = 992;

export default function AppLayout() {
    const { user, logout, can } = useAuth();
    const location = useLocation();
    const [userMenu, setUserMenu] = useState(false);

    useEffect(() => {
        document.body.className = 'layout-fixed sidebar-expand-lg bg-body-tertiary';
    }, []);

    // Close the mobile sidebar after navigating.
    useEffect(() => {
        document.body.classList.remove('sidebar-open');
        setUserMenu(false);
    }, [location.pathname]);

    const toggleSidebar = (e) => {
        e.preventDefault();
        if (window.innerWidth >= LG) document.body.classList.toggle('sidebar-collapse');
        else document.body.classList.toggle('sidebar-open');
    };

    const items = nav.filter((i) => i.header || can(i.perm));
    const visible = items.filter((i, idx) => !i.header || (items[idx + 1] && !items[idx + 1].header));

    return (
        <div className="app-wrapper">
            <nav className="app-header navbar navbar-expand bg-body">
                <div className="container-fluid">
                    <ul className="navbar-nav">
                        <li className="nav-item">
                            <a className="nav-link" href="#" role="button" aria-label="Toggle sidebar" onClick={toggleSidebar}>
                                <i className="bi bi-list" />
                            </a>
                        </li>
                        <li className="nav-item d-none d-md-block">
                            <Link to="/" className="nav-link"><i className="bi bi-grid-1x2 me-1" /> Dashboard</Link>
                        </li>
                    </ul>
                    <ul className="navbar-nav ms-auto">
                        <li className="nav-item dropdown user-menu">
                            <a href="#" className="nav-link dropdown-toggle" onClick={(e) => { e.preventDefault(); setUserMenu(!userMenu); }}>
                                <span className="user-image rounded-circle shadow d-inline-flex align-items-center justify-content-center text-bg-primary" style={{ width: 25, height: 25, fontSize: 12 }}>
                                    {initials(user?.name)}
                                </span>
                                <span className="d-none d-md-inline ms-1">{user?.name}</span>
                            </a>
                            <ul className={`dropdown-menu dropdown-menu-lg dropdown-menu-end ${userMenu ? 'show' : ''}`} style={userMenu ? { right: 0 } : undefined}>
                                <li className="user-header text-bg-primary">
                                    <p>
                                        {user?.name} – {user?.roles?.join(', ')}
                                        <small>{user?.email}</small>
                                    </p>
                                </li>
                                <li className="user-footer">
                                    <Link to="/profile" className="btn btn-outline-secondary">Profile</Link>
                                    <button type="button" className="btn btn-outline-danger float-end" onClick={logout}>Sign out</button>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </div>
            </nav>

            <aside className="app-sidebar bg-body-secondary shadow" data-bs-theme="dark">
                <div className="sidebar-brand">
                    <Link to="/" className="brand-link">
                        <img src="/storage/images/logo_aani.png" alt="" className="brand-image opacity-75 shadow" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        <span className="brand-text fw-light"><b>AANI</b> GEMAS</span>
                    </Link>
                </div>
                <div className="sidebar-wrapper" style={{ overflowY: 'auto' }}>
                    <nav className="mt-2" aria-label="Main navigation">
                        <ul className="nav sidebar-menu flex-column" role="navigation">
                            {visible.map((item, i) =>
                                item.header ? (
                                    <li key={i} className="nav-header">{item.header}</li>
                                ) : item.children ? (
                                    <TreeItem key={i} item={item} pathname={location.pathname} />
                                ) : (
                                    <li key={i} className="nav-item">
                                        <NavLink to={item.to} end={item.to === '/'} className="nav-link">
                                            <i className={`nav-icon bi ${item.icon}`} />
                                            <p>{item.label}</p>
                                        </NavLink>
                                    </li>
                                ),
                            )}
                        </ul>
                    </nav>
                </div>
            </aside>

            <main className="app-main">
                <Outlet />
            </main>

            <footer className="app-footer">
                <div className="float-end d-none d-sm-inline">Admin panel</div>
                <strong>&copy; {new Date().getFullYear()} AANI GEMAS.</strong>
            </footer>
            <div className="sidebar-overlay" onClick={() => document.body.classList.remove('sidebar-open')} />
        </div>
    );
}

function TreeItem({ item, pathname }) {
    const active = item.children.some((c) => pathname.startsWith(c.to));
    const [open, setOpen] = useState(active);
    useEffect(() => {
        if (active) setOpen(true);
    }, [active]);
    return (
        <li className={`nav-item ${open ? 'menu-open' : ''}`}>
            <a href="#" className={`nav-link ${active ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setOpen(!open); }}>
                <i className={`nav-icon bi ${item.icon}`} />
                <p>
                    {item.label}
                    <i className="nav-arrow bi bi-chevron-right" />
                </p>
            </a>
            <ul className="nav nav-treeview" style={{ display: open ? 'block' : 'none' }}>
                {item.children.map((c) => (
                    <li key={c.to} className="nav-item">
                        <NavLink to={c.to} className="nav-link">
                            <i className="nav-icon bi bi-circle" />
                            <p>{c.label}</p>
                        </NavLink>
                    </li>
                ))}
            </ul>
        </li>
    );
}

function initials(name = '') {
    return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}
