import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { Spinner } from './ui';

/**
 * Server-side DataTable: pagination, sorting and filters handled by the API
 * (expects Laravel paginated resources: {data, meta:{current_page,last_page,total}}).
 *
 * columns: [{key, label, sortable?, render?(row), className?}]
 * filters: object of query params (controlled by parent)
 */
export default function DataTable({ url, columns, filters = {}, defaultSort = '', perPage = 20, rowKey = 'id', reloadKey = 0, onRowClick, empty = 'No records found.' }) {
    const [page, setPage] = useState(1);
    const [sort, setSort] = useState(defaultSort);
    const [state, setState] = useState({ loading: true, rows: [], meta: null, error: null });

    const filterKey = JSON.stringify(filters);
    useEffect(() => setPage(1), [filterKey]);

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
    const sortIcon = (key) => (sort === key ? 'bi-sort-up' : sort === `-${key}` ? 'bi-sort-down' : 'bi-arrow-down-up opacity-25');

    const meta = state.meta;
    return (
        <div>
            <div className="table-responsive">
                <table className="table table-hover table-striped align-middle mb-0">
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} className={c.className} style={c.sortable ? { cursor: 'pointer', whiteSpace: 'nowrap' } : { whiteSpace: 'nowrap' }} onClick={c.sortable ? () => toggleSort(c.key) : undefined}>
                                    {c.label} {c.sortable && <i className={`bi ${sortIcon(c.key)}`} />}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {state.loading && (
                            <tr><td colSpan={columns.length}><Spinner /></td></tr>
                        )}
                        {!state.loading && state.error && (
                            <tr><td colSpan={columns.length} className="text-danger">{state.error}</td></tr>
                        )}
                        {!state.loading && !state.error && state.rows.length === 0 && (
                            <tr><td colSpan={columns.length} className="text-secondary text-center py-4">{empty}</td></tr>
                        )}
                        {!state.loading && state.rows.map((row) => (
                            <tr key={row[rowKey]} onClick={onRowClick ? () => onRowClick(row) : undefined} style={onRowClick ? { cursor: 'pointer' } : undefined}>
                                {columns.map((c) => (
                                    <td key={c.key} className={c.className}>{c.render ? c.render(row, load) : row[c.key]}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {meta && meta.last_page > 1 && (
                <div className="d-flex justify-content-between align-items-center p-2 border-top">
                    <small className="text-secondary">
                        {meta.from}–{meta.to} of {meta.total}
                    </small>
                    <ul className="pagination pagination-sm m-0">
                        <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => setPage(page - 1)}>«</button>
                        </li>
                        {pages(page, meta.last_page).map((p, i) => (
                            <li key={i} className={`page-item ${p === page ? 'active' : ''} ${p === '…' ? 'disabled' : ''}`}>
                                <button className="page-link" onClick={() => typeof p === 'number' && setPage(p)}>{p}</button>
                            </li>
                        ))}
                        <li className={`page-item ${page >= meta.last_page ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => setPage(page + 1)}>»</button>
                        </li>
                    </ul>
                </div>
            )}
            {meta && meta.last_page <= 1 && meta.total > 0 && (
                <div className="p-2 border-top"><small className="text-secondary">{meta.total} record{meta.total === 1 ? '' : 's'}</small></div>
            )}
        </div>
    );
}

function pages(current, last) {
    const out = [];
    for (let p = 1; p <= last; p++) {
        if (p === 1 || p === last || Math.abs(p - current) <= 2) out.push(p);
        else if (out[out.length - 1] !== '…') out.push('…');
    }
    return out;
}

/** Small search + filter bar helper. */
export function FilterBar({ children }) {
    return <div className="row g-2 align-items-end mb-3">{children}</div>;
}
