import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { SearchInput } from '../../components/DataTable';
import { EmptyState, Icon, Initials, Page, Skeleton, StatusBadge, formatDate, useFlash } from '../../components/ui';

const FOLDERS = [['', 'All messages', 'messages'], ['new', 'New', 'notification-on'], ['read', 'Read', 'eye'], ['replied', 'Replied', 'paper-plane']];

export default function Inbox() {
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [list, setList] = useState(null);
    const [open, setOpen] = useState(null);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [flash, setFlash] = useFlash();

    const load = () => api.get('/messages', { params: { status, q, page } }).then(({ data }) => setList(data));
    useEffect(() => { load(); }, [status, q, page]); // eslint-disable-line react-hooks/exhaustive-deps

    const show = async (m) => {
        const { data } = await api.get(`/messages/${m.id}`);
        setOpen(data.data);
        setReply('');
        load();
    };
    const send = async () => {
        setSending(true);
        try {
            const { data } = await api.post(`/messages/${open.id}/reply`, { body: reply });
            setOpen(data.data);
            setReply('');
            setFlash('Reply sent.');
            load();
        } catch (e) {
            setFlash(fieldErrors(e).body || errorMessage(e), 'danger');
        } finally {
            setSending(false);
        }
    };
    const setSt = async (s) => {
        const { data } = await api.put(`/messages/${open.id}`, { status: s });
        setOpen(data.data);
        load();
    };
    const mailto = (m) => `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.topic || 'Your message'}`)}`;
    const counts = list?.counts || {};

    return (
        <Page title="Contact inbox" crumbs={[{ label: 'Messages' }, { label: 'Inbox' }]}>
            {flash}
            <div className="flex flex-col lg:flex-row gap-5 lg:gap-7.5 items-start">
                <div className="kt-card w-full lg:w-[250px] shrink-0">
                    <div className="kt-card-content p-2.5 flex flex-col gap-0.5">
                        {FOLDERS.map(([v, l, i]) => (
                            <button key={v} type="button" onClick={() => { setStatus(v); setPage(1); setOpen(null); }}
                                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${status === v ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-accent'}`}>
                                <Icon name={i} className="text-base" /> {l}
                                {v && <span className={`kt-badge kt-badge-sm ms-auto ${v === 'new' && counts.new ? 'kt-badge-destructive' : 'kt-badge-outline'}`}>{counts[v] || 0}</span>}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grow w-full min-w-0">
                    {open ? (
                        <div className="kt-card page-enter">
                            <div className="kt-card-header">
                                <div className="flex items-center gap-2.5">
                                    <button className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost" onClick={() => setOpen(null)} title="Back"><Icon name="arrow-left" /></button>
                                    <h3 className="kt-card-title">{open.topic || 'Message'}</h3>
                                    <StatusBadge value={open.status} />
                                </div>
                                <div className="flex gap-1.5">
                                    <button className="kt-btn kt-btn-sm kt-btn-outline" onClick={() => setSt('new')}><Icon name="notification-on" /> Mark unread</button>
                                    <button className="kt-btn kt-btn-sm kt-btn-outline" onClick={() => setSt('replied')}><Icon name="check" /> Mark replied</button>
                                </div>
                            </div>
                            <div className="kt-card-content flex flex-col gap-5">
                                <div className="flex items-center gap-3">
                                    <Initials name={open.name} className="size-10 text-sm" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-mono">{open.name}</span>
                                        <a href={mailto(open)} className="text-xs kt-link">{open.email}</a>
                                    </div>
                                    <span className="ms-auto text-xs text-secondary-foreground text-end">{formatDate(open.created_at)}<br />via {open.source}</span>
                                </div>
                                <div className="rounded-xl border border-border bg-muted/40 p-5 text-sm text-foreground whitespace-pre-wrap leading-6">{open.message}</div>
                                {open.replied_at && <div className="text-xs text-green-600 flex items-center gap-1.5"><Icon name="check-circle" /> Replied {formatDate(open.replied_at)}{open.admin && ` by ${open.admin.name}`}</div>}
                                <div className="flex flex-col gap-2.5">
                                    <textarea className="kt-textarea" rows={6} placeholder="Write a reply (sent by email)…" value={reply} onChange={(e) => setReply(e.target.value)} />
                                    <div className="flex gap-2.5 justify-end">
                                        <a className="kt-btn kt-btn-outline" href={mailto(open)}><Icon name="sms" /> Reply in mail app</a>
                                        <button className="kt-btn kt-btn-primary" disabled={!reply.trim() || sending} onClick={send}><Icon name="paper-plane" /> {sending ? 'Sending…' : 'Send reply'}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="kt-card">
                            <div className="kt-card-header py-3">
                                <h3 className="kt-card-title">{FOLDERS.find((f) => f[0] === status)?.[1]}</h3>
                                <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search messages" />
                            </div>
                            <div className="kt-card-content p-0">
                                {!list && <div className="p-5 grid gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
                                {list && list.data.map((m) => (
                                    <button key={m.id} type="button" onClick={() => show(m)}
                                        className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-border last:border-b-0 text-start hover:bg-muted/50 transition-colors">
                                        <span className={`size-2 rounded-full shrink-0 ${m.status === 'new' ? 'bg-primary' : 'bg-transparent'}`} />
                                        <Initials name={m.name} />
                                        <div className="flex flex-col min-w-0 grow">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm truncate ${m.status === 'new' ? 'font-semibold text-mono' : 'text-foreground'}`}>{m.name}</span>
                                                {m.topic && <span className="kt-badge kt-badge-sm kt-badge-outline shrink-0">{m.topic}</span>}
                                            </div>
                                            <span className="text-xs text-secondary-foreground truncate">{m.message}</span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span className="text-xs text-secondary-foreground whitespace-nowrap">{formatDate(m.created_at)}</span>
                                            <StatusBadge value={m.status} />
                                        </div>
                                    </button>
                                ))}
                                {list && !list.data.length && <EmptyState title="No messages" text="Messages from the storefront contact form appear here." illustration="32" />}
                            </div>
                            {list && list.meta.last_page > 1 && (
                                <div className="kt-card-footer justify-between text-sm text-secondary-foreground">
                                    <span>{list.meta.from}-{list.meta.to} of {list.meta.total}</span>
                                    <div className="kt-datatable-pagination">
                                        <button className="kt-datatable-pagination-button" disabled={page <= 1} onClick={() => setPage(page - 1)}><Icon name="black-left" className="text-xs" /></button>
                                        <span className="px-2">{page} / {list.meta.last_page}</span>
                                        <button className="kt-datatable-pagination-button" disabled={page >= list.meta.last_page} onClick={() => setPage(page + 1)}><Icon name="black-right" className="text-xs" /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Page>
    );
}
