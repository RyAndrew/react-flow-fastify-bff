const LogViewer = ({ urlFilter }) => {
    const [logs, setLogs] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [expanded, setExpanded] = React.useState(null);

    React.useEffect(() => {
        const params = new URLSearchParams({ limit: '50' });
        if (urlFilter) params.set('url_contains', urlFilter);
        api(`/api/v1/logs?${params}`).then(({ data }) => { setLogs(data.logs || []); setLoading(false); });
    }, [urlFilter]);

    if (loading) return <div className="text-center py-3"><div className="spinner-border text-primary" /></div>;
    if (!logs.length) return <p className="text-muted">No logs found.</p>;

    return (
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <table className="table table-sm table-striped log-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Method</th>
                        <th>URL</th>
                        <th>Status</th>
                        <th>ms</th>
                        <th>DS Status</th>
                        <th>DS ms</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map(log => (
                        <React.Fragment key={log.id}>
                            <tr onClick={() => setExpanded(expanded === log.id ? null : log.id)} style={{ cursor: 'pointer' }}>
                                <td>{new Date(log.created_at).toLocaleTimeString()}</td>
                                <td><span className="badge bg-dark">{log.method}</span></td>
                                <td title={log.url}>{log.url}</td>
                                <td><span className={`badge bg-${log.status_code < 400 ? 'success' : 'danger'}`}>{log.status_code}</span></td>
                                <td>{log.duration_ms}</td>
                                <td>{log.downstream_status_code ? <span className={`badge bg-${log.downstream_status_code < 400 ? 'info' : 'danger'}`}>{log.downstream_status_code}</span> : '—'}</td>
                                <td>{log.downstream_duration_ms || '—'}</td>
                                <td>{expanded === log.id ? '▲' : '▼'}</td>
                            </tr>
                            {expanded === log.id && (
                                <tr>
                                    <td colSpan={8}>
                                        <div className="p-2">
                                            {log.request_body && <div className="mb-2"><strong className="small">Request Body:</strong><pre className="json-pre">{fmtJson(log.request_body)}</pre></div>}
                                            {log.error && <div className="mb-2"><strong className="small text-danger">Error:</strong><pre className="json-pre text-danger">{log.error}</pre></div>}
                                            {log.downstream_url && <div className="mb-2"><strong className="small">Downstream URL:</strong> <code>{log.downstream_url}</code></div>}
                                            {log.downstream_request_body && <div className="mb-2"><strong className="small">Downstream Request:</strong><pre className="json-pre">{fmtJson(log.downstream_request_body)}</pre></div>}
                                            {log.downstream_response_body && <div className="mb-2"><strong className="small">Downstream Response:</strong><pre className="json-pre">{fmtJson(log.downstream_response_body)}</pre></div>}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
