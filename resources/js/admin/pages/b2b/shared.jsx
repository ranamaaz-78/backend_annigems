import { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import api from '../../api';
import { Money, eur } from '../../components/ui';
import { chartColors } from '../../lib';

export const B2B_CRUMB = { label: 'B2B', to: '/b2b' };

export const GROUPS = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
];

/** Tiers + categories (discount matrix) + active countries (onboarding address). */
export function useTiers(reloadKey = 0) {
    const [d, setD] = useState({ tiers: [], categories: [], countries: [] });
    useEffect(() => { api.get('/b2b/tiers').then(({ data }) => setD(data.data)).catch(() => {}); }, [reloadKey]);
    return d;
}

/** Active sales persons for selects (staff only; sales persons get an empty list). */
export function useSalesRepOptions(enabled = true) {
    const [reps, setReps] = useState([]);
    useEffect(() => {
        if (enabled) api.get('/b2b/sales-reps-options').then(({ data }) => setReps(data.data)).catch(() => setReps([]));
    }, [enabled]);
    return reps;
}

/** From / to / day-week-month filter used by the dashboard and commission screens. */
export function PeriodFilter({ value, onChange }) {
    const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
    return (
        <div className="flex flex-wrap items-center gap-2.5">
            <div className="kt-input kt-input-sm w-40"><input type="date" value={value.from} onChange={set('from')} title="From" /></div>
            <div className="kt-input kt-input-sm w-40"><input type="date" value={value.to} onChange={set('to')} title="To" /></div>
            <div className="flex gap-1 rounded-lg border border-border p-0.5" role="tablist" aria-label="Group by">
                {GROUPS.map((g) => (
                    <button key={g.value} type="button" role="tab" aria-selected={value.group === g.value}
                        className={`kt-btn kt-btn-sm ${value.group === g.value ? 'kt-btn-primary' : 'kt-btn-ghost'}`}
                        onClick={() => onChange({ ...value, group: g.value })}>{g.label}</button>
                ))}
            </div>
        </div>
    );
}

export const defaultPeriod = (group = 'day') => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - (group === 'month' ? 364 : group === 'week' ? 89 : 29));
    const iso = (d) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to), group };
};

/** Sales (bars) and commission (line) per period, EUR. */
export function SalesChart({ series, height = 280 }) {
    const dark = document.documentElement.classList.contains('dark');
    const muted = dark ? '#a1a1aa' : '#71717a';
    const { primary, second } = chartColors(dark);
    const options = {
        chart: { toolbar: { show: false }, fontFamily: 'Inter, sans-serif', animations: { enabled: true, speed: 500 } },
        dataLabels: { enabled: false },
        stroke: { width: [0, 3], curve: 'smooth' },
        colors: [primary, second],
        plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
        xaxis: {
            categories: series.map((r) => r.period),
            axisBorder: { show: false }, axisTicks: { show: false },
            labels: { style: { colors: muted, fontSize: '12px' }, rotate: 0, hideOverlappingLabels: true },
            tickAmount: 8,
        },
        yaxis: [
            { labels: { style: { colors: muted, fontSize: '12px' }, formatter: (v) => `€${Math.round(v).toLocaleString()}` } },
            { opposite: true, labels: { style: { colors: muted, fontSize: '12px' }, formatter: (v) => `€${Math.round(v).toLocaleString()}` } },
        ],
        legend: { labels: { colors: muted } },
        grid: { borderColor: dark ? '#27272a' : '#f1f1f4', strokeDashArray: 5 },
        tooltip: { theme: dark ? 'dark' : 'light', shared: true, intersect: false, y: { formatter: (v) => eur(Math.round(v * 100)) } },
    };
    return (
        <Chart
            options={options}
            series={[
                { name: 'Sales', type: 'column', data: series.map((r) => r.sales_eur / 100) },
                { name: 'Commission', type: 'line', data: series.map((r) => r.commission_eur / 100) },
            ]}
            type="line"
            height={height}
        />
    );
}

/** Table of sales/commission per business for a period. */
export function ByBusinessTable({ rows, onOpen }) {
    if (!rows.length) return <div className="text-sm text-secondary-foreground p-5">No orders in this period.</div>;
    return (
        <div className="kt-scrollable-x-auto">
            <table className="kt-table kt-table-border align-middle">
                <thead><tr><th>Business</th><th className="text-end">Orders</th><th className="text-end">Sales</th><th className="text-end">Commission</th></tr></thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.user_id} className={onOpen ? 'row-link' : ''} onClick={onOpen ? () => onOpen(r) : undefined}>
                            <td className="text-sm font-medium text-mono">{r.company_name || '—'}</td>
                            <td className="text-end text-sm">{r.orders}</td>
                            <td className="text-end text-sm"><Money value={r.sales} /></td>
                            <td className="text-end text-sm"><Money value={r.commission} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
