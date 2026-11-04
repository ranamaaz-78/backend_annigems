import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { Card, Page, Spinner, StatusBadge, formatDate, useFlash } from '../../components/ui';

export default function Inbox() {
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [list, setList] = useState(null);
    const [open, setOpen] = useState(null);
    const [reply, setReply] = useState('');
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
        try {
            const { data } = await api.post(`/messages/${open.id}/reply`, { body: reply });
            setOpen(data.data);
            setReply('');
            setFlash('Reply sent.');
            load();
        } catch (e) {
            setFlash(fieldErrors(e).body || errorMessage(e), 'danger');
        }
    };
    const setSt = async (s) => {
        const { data } = await api.put(`/messages/${open.id}`, { status: s });
        setOpen(data.data);
        load();
    };

    const counts = list?.counts || {};
    return (
        <Page title="Contact inbox" crumbs={[{ label: 'Messages' }, { label: 'Inbox' }]}>
            {flash}
            <div className="row">
                <div className="col-lg-3">
                    <Card noBody title="Folders">
                        <div className="list-group list-group-flush">
                            {[['', 'All'], ['new', 'New'], ['read', 'Read'], ['replied', 'Replied']].map(([v, l]) => (
                                <button key={v} className={`list-group-item list-group-item-action d-flex justify-content-between ${status === v ? 'active' : ''}`} onClick={() => { setStatus(v); setPage(1); }}>
                                    {l} {v && <span className="badge text-bg-secondary">{counts[v] || 0}</span>}
                                </button>
                            ))}
                        </div>
                    </Card>
                </div>
                <div className="col-lg-9">
                    {open ? (
                        <Card title={<>{open.topic || 'Message'} <StatusBadge value={open.status} /></>} outline="primary"
                            tools={<button className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(null)}><i className="bi bi-arrow-left" /> Back</button>}>
                            <div className="mb-3">
                                <strong>{open.name}</strong> &lt;<a href={`mailto:${open.email}?subject=${encodeURIComponent('Re: ' + (open.topic || 'Your message'))}`}>{open.email}</a>&gt;
                                <span className="float-end small text-secondary">{formatDate(open.created_at)} · {open.source}</span>
                            </div>
                            <div className="p-3 bg-body-tertiary rounded mb-3" style={{ whiteSpace: 'pre-wrap' }}>{open.message}</div>
                            {open.replied_at && <p className="small text-success">Replied {formatDate(open.replied_at)}{open.admin && ` by ${open.admin.name}`}</p>}
                            <textarea className="form-control mb-2" rows={6} placeholder="Write a reply (sent by email)…" value={reply} onChange={(e) => setReply(e.target.value)} />
                            <div className="d-flex gap-2">
                                <button className="btn btn-primary" disabled={!reply.trim()} onClick={send}><i className="bi bi-send" /> Send reply</button>
                                <a className="btn btn-outline-secondary" href={`mailto:${open.email}?subject=${encodeURIComponent('Re: ' + (open.topic || 'Your message'))}`}><i className="bi bi-envelope" /> Reply in mail app</a>
                                <div className="ms-auto btn-group">
                                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setSt('new')}>Mark unread</button>
                                    <button className="btn btn-outline-success btn-sm" onClick={() => setSt('replied')}>Mark replied</button>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <Card noBody title={<input className="form-control form-control-sm" style={{ width: 260 }} placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}>
                            {!list ? <Spinner /> : (
                                <table className="table table-hover mb-0 mailbox-messages">
                                    <tbody>
                                        {list.data.map((m) => (
                                            <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => show(m)} className={m.status === 'new' ? 'fw-bold' : ''}>
                                                <td style={{ width: 24 }}>{m.status === 'new' && <i className="bi bi-circle-fill text-primary small" />}</td>
                                                <td>{m.name}<div className="small text-secondary fw-normal">{m.email}</div></td>
                                                <td>{m.topic && <span className="badge text-bg-light border me-2 fw-normal">{m.topic}</span>}<span className="fw-normal">{m.message.slice(0, 80)}{m.message.length > 80 && '…'}</span></td>
                                                <td><StatusBadge value={m.status} /></td>
                                                <td className="small text-nowrap fw-normal">{formatDate(m.created_at)}</td>
                                            </tr>
                                        ))}
                                        {!list.data.length && <tr><td className="text-center text-secondary py-4">No messages.</td></tr>}
                                    </tbody>
                                </table>
                            )}
                            {list && list.meta.last_page > 1 && (
                                <div className="p-2 d-flex justify-content-end gap-2">
                                    <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>«</button>
                                    <span className="small align-self-center">{page} / {list.meta.last_page}</span>
                                    <button className="btn btn-sm btn-outline-secondary" disabled={page >= list.meta.last_page} onClick={() => setPage(page + 1)}>»</button>
                                </div>
                            )}
                        </Card>
                    )}
                </div>
            </div>
        </Page>
    );
}
