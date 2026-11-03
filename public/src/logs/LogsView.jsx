// The Logs tab: one view over the BFF access log (Internal / SCIM Client) and the Okta System Log.
// `request` ({ source, context, nonce }) comes from App when another area opens the tab ("View Logs");
// its context ({ label, filters: { <source>: {...} } }) replaces the current filters and runs the query.
// Stays mounted while hidden so filters and results survive tab switches; `active` defers the first load.
const LogsView = ({ request, active }) => {
    const [source, setSource] = React.useState('internal');
    const [context, setContext] = React.useState(null);
    const [filters, setFilters] = React.useState(() => logFiltersFor(null));
    const [result, setResult] = React.useState(null); // { source, applied, logs, next }
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const queryId = React.useRef(0); // ignore responses from superseded queries

    // cursor set → append the next page to the current result
    const runQuery = async (src, f, cursor) => {
        const id = ++queryId.current;
        setLoading(true); setError(null);
        if (!cursor) setResult(null);
        let res;
        try { res = await api(buildLogQueryUrl(src, f, cursor)); }
        catch (e) { res = { ok: false, data: e.message || 'Request failed' }; }
        if (id !== queryId.current) return;
        setLoading(false);
        if (!res.ok) { setError(res.data); return; }
        const logs = res.data.logs || [];
        setResult(prev => cursor
            ? { ...prev, logs: [...prev.logs, ...logs], next: res.data.next }
            : { source: src, applied: f, logs, next: res.data.next });
    };

    React.useEffect(() => {
        if (!request) return;
        const f = logFiltersFor(request.context);
        setSource(request.source); setContext(request.context || null); setFilters(f);
        runQuery(request.source, f[request.source]);
    }, [request]);

    // Opened from the tab itself (no request): load the current source once
    React.useEffect(() => {
        if (active && !request && !result && !loading && !error) runQuery(source, filters[source]);
    }, [active]);

    const changeSource = (id) => { setSource(id); runQuery(id, filters[id]); };
    const setSourceFilters = (f) => setFilters(all => ({ ...all, [source]: f }));
    const resetFilters = () => setSourceFilters(logFiltersFor(context)[source]);
    const clearContext = () => {
        const f = logFiltersFor(null);
        setContext(null); setFilters(f);
        runQuery(source, f[source]);
    };

    const shown = result?.source === source ? result : null;
    const edited = shown && JSON.stringify(shown.applied) !== JSON.stringify(filters[source]);
    const sourceLabel = (id) => LOG_SOURCES.find(s => s.id === id)?.label;

    return (
        <div style={{ height: 'calc(100vh - 56px)', overflow: 'auto' }}>
            <div className="container-fluid p-3">
                <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
                    <ul className="nav nav-pills">
                        {LOG_SOURCES.map(s => (
                            <li className="nav-item" key={s.id}>
                                <button className={`nav-link py-1 ${source === s.id ? 'active' : ''}`} onClick={() => changeSource(s.id)}>{s.label}</button>
                            </li>
                        ))}
                    </ul>
                    {context && (
                        <div className="alert alert-info py-1 px-2 mb-0 ms-auto small d-flex align-items-center gap-2">
                            <span>Context: <strong>{context.label}</strong>{!context.filters?.[source] && <span className="text-muted"> (no {sourceLabel(source)} filter)</span>}</span>
                            <button className="btn-close btn-sm" title="Clear context filters" onClick={clearContext} />
                        </div>
                    )}
                </div>

                <div className="p-2 bg-light border rounded mb-2">
                    <LogFilters source={source} filters={filters[source]} onChange={setSourceFilters}
                        onApply={() => runQuery(source, filters[source])} onReset={resetFilters} loading={loading} />
                    {shown && (
                        <div className="small text-muted d-flex flex-wrap align-items-center gap-1">
                            <span>Showing {shown.logs.length}{shown.next ? '+' : ''} from {sourceLabel(shown.source)} ·</span>
                            {describeLogFilters(shown.source, shown.applied).map(d => (
                                <span key={d} className="badge bg-white text-dark border fw-normal">{d}</span>
                            ))}
                            {edited && <span className="text-warning ms-1">Filters changed — press {source === 'okta' ? 'Query Okta' : 'Search'} to apply</span>}
                        </div>
                    )}
                </div>

                {error && <ApiError data={error} />}
                {shown && !shown.logs.length && <p className="text-muted">No logs found.</p>}
                {shown && shown.logs.length > 0 && (source === 'okta' ? <OktaLogTable logs={shown.logs} /> : <AccessLogTable logs={shown.logs} />)}
                {loading && <div className="text-center py-3"><div className="spinner-border text-primary" /></div>}
                {shown?.next && !loading && (
                    <div className="text-center mb-3">
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => runQuery(shown.source, shown.applied, shown.next)}>Load more</button>
                    </div>
                )}
            </div>
        </div>
    );
};
