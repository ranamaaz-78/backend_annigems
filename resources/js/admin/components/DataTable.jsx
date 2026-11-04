import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { EmptyState, Icon, Skeleton } from './ui';

/**
 * Server-side DataTable in Metronic style (kt-table + kt-datatable pagination):
 * pagination, sorting and filters are handled by the API
 * (expects {data, meta:{current_page,last_page,total,from,to}}).
 *
 * columns: [{key, label, sortable?, render?(row, reload), className?, width?}]
 */
export default function DataTable({ url, columns, filters = {}, defaultSort = '', perPage: initialPerPage = 20, rowKey = 'id', reloadKey = 0, onRowClick, empty = 'No records found.' }) {
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(initialPerPage);
    const [sort, setSort] = useState(defaultSort);
    const [state, setState] = useState({ loading: true, rows: [], meta: null, error: null });

    const filterKey = JSON.stringify(filters);
    useEffect(() => setPage(1), [filterKey, perPage]);

    const load = useCallback(async () => {
        setState((s) => ({ ...s, loading: true, error: null }));
        try {
            const params = { ...filters, page, per_page: perPage };
            if (sort) params.sort = sort;
            Object.keys(params).forEach((k) => (params[k] === '' || params[k] === null || params[k] === undefined) && delete params[k]);
            const { data } = await api.get(url, { params });
            setState({ loading: false, rows: data.data, meta: data.meta, error: null });
        } catch (e) {
            setState({ loading: false, rows: [], meta: null, error: errorMessage(e) });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, filterKey, page, sort, perPage, reloadKey]);

    useEffect(() => {
        load();
    }, [load]);

    const toggleSort = (key) => setSort((s) => (s === key ? `-${key}` : key));
    const ariaSort = (key) => (sort === key ? 'asc' : sort === `-${key}` ? 'desc' : undefined);
    const meta = state.meta;
    const firstLoad = state.loading && !state.rows.length;

    return (
        <div className="grid">
            <div className="kt-scrollable-x-auto relative">
                <table className="kt-table kt-table-border align-middle">
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} className={`${c.className || ''} whitespace-nowrap`} style={c.width ? { width: c.width } : undefined} aria-sort={c.sortable ? ariaSort(c.key) : undefined}>
                                    {c.sortable ? (
                                        <span className="kt-table-col cursor-pointer select-none" onClick={() => toggleSort(c.key)}>
                                            <span className="kt-table-col-label">{c.label}</span>
                                            <span className="kt-table-col-sort" />
                                        </span>
                                    ) : c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className={state.loading && !firstLoad ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
                        {firstLoad && [0, 1, 2, 3, 4].map((i) => (
                            <tr key={`sk-${i}`}>
                                {columns.map((c) => <td key={c.key}><Skeleton className="h-4 w-3/4" /></td>)}
                            </tr>
                        ))}
                        {!state.loading && state.error && (
                            <tr><td colSpan={columns.length} className="text-destructive text-sm py-6 text-center">{state.error}</td></tr>
                        )}
                        {!state.loading && !state.error && state.rows.length === 0 && (
                            <tr><td colSpan={columns.length}><EmptyState title={empty} illustration="22" /></td></tr>
                        )}
                        {!firstLoad && state.rows.map((row) => (
                            <tr key={row[rowKey]} onClick={onRowClick ? () => onRowClick(row) : undefined} className={onRowClick ? 'row-link' : ''}>
                                {columns.map((c) => (
                                    <td key={c.key} className={c.className}>{c.render ? c.render(row, load) : row[c.key]}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {meta && meta.total > 0 && (
                <div className="kt-card-footer justify-center md:justify-between flex-col md:flex-row gap-5 text-secondary-foreground text-sm font-medium">
                    <div className="flex items-center gap-2 order-2 md:order-1">
                        Show
                        <select className="kt-select kt-select-sm w-16" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
                            {[10, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        per page
                    </div>
                    <div className="flex items-center gap-4 order-1 md:order-2">
                        <span>{meta.from ?? 0}-{meta.to ?? 0} of {meta.total}</span>
                        {meta.last_page > 1 && (
                            <div className="kt-datatable-pagination">
                                <button type="button" className="kt-datatable-pagination-button kt-datatable-pagination-prev" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                    <Icon name="black-left" className="text-xs" />
                                </button>
                                {pages(page, meta.last_page).map((p, i) => (
                                    <button
                                        type="button"
                                        key={i}
                                        disabled={p === '…'}
                                        className={`kt-datatable-pagination-button ${p === page ? 'active' : ''} ${p === '…' ? 'kt-datatable-pagination-more' : ''}`}
                                        onClick={() => typeof p === 'number' && setPage(p)}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button type="button" className="kt-datatable-pagination-button kt-datatable-pagination-next" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>
                                    <Icon name="black-right" className="text-xs" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function pages(current, last) {
    const out = [];
    for (let p = 1; p <= last; p++) {
        if (p === 1 || p === last || Math.abs(p - current) <= 1) out.push(p);
        else if (out[out.length - 1] !== '…') out.push('…');
    }
    return out;
}

/** Search input with the magnifier icon (Metronic card header style). */
export function SearchInput({ value, onChange, placeholder = 'Search…', className = 'w-full sm:w-64' }) {
    return (
        <div className={`kt-input ${className}`}>
            <Icon name="magnifier" />
            <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}

/** Filter row inside a card header / above a table. */
export function FilterBar({ children }) {
    return <div className="flex flex-wrap items-center gap-2.5">{children}</div>;
}
