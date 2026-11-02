// Fetches the factor catalog, user picks a factor to enroll
const EnrollFactorContent = ({ userId }) => {
    const [catalog, setCatalog] = React.useState([]);
    const [catalogLoading, setCatalogLoading] = React.useState(true);
    const [catalogError, setCatalogError] = React.useState(null);
    const [selectedIdx, setSelectedIdx] = React.useState('');
    const [payload, setPayload] = React.useState('');
    const [status, setStatus] = React.useState('idle');
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        setCatalogLoading(true);
        setCatalogError(null);
        setCatalog([]);
        setSelectedIdx('');
        setPayload('');
        setStatus('idle');
        setResult(null);
        setError(null);
        api(`/api/v1/users/${userId}/factors/catalog`).then(({ ok, data }) => {
            if (ok) {
                setCatalog(data.factors || []);
            } else {
                setCatalogError(data.details?.errorSummary || data.error || 'Failed to load factor catalog');
            }
            setCatalogLoading(false);
        });
    }, [userId]);

    const handleFactorChange = (idx) => {
        setSelectedIdx(idx);
        setStatus('idle');
        setResult(null);
        setError(null);
        if (idx === '') { setPayload(''); return; }
        const factor = catalog[parseInt(idx, 10)];
        setPayload(JSON.stringify(buildFactorPayload(factor), null, 2));
    };

    const handleEnroll = async () => {
        let parsed;
        try { parsed = JSON.parse(payload); } catch { setError('Invalid JSON'); return; }
        setStatus('running'); setError(null);
        const { ok, data } = await apiPost(`/api/v1/users/${userId}/factors`, parsed);
        if (ok) { setStatus('done'); setResult(data); }
        else { setStatus('error'); setError(data.details?.errorSummary || data.error || 'Enrollment failed'); }
    };

    const reset = () => { setStatus('idle'); setResult(null); setError(null); };

    if (catalogLoading) return <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-info" /></div>;
    if (catalogError) return <div className="alert alert-danger small">{catalogError}</div>;
    if (!catalog.length) return <div className="alert alert-info small mb-0">No enrollable factors available for this user.</div>;

    return (
        <div>
            <div className="mb-2 font-monospace small">
                <span className="badge bg-dark me-2">POST</span>
                <code>/api/v1/users/{userId}/factors</code>
            </div>
            <label className="form-label small fw-bold">Select a factor to enroll:</label>
            <select className="form-select mb-3" value={selectedIdx} onChange={e => handleFactorChange(e.target.value)}>
                <option value="">-- Choose a factor --</option>
                {catalog.map((f, i) => (
                    <option key={`${f.factorType}-${f.provider}-${i}`} value={i}>
                        {factorDisplayName(f)}
                    </option>
                ))}
            </select>
            {selectedIdx !== '' && status === 'idle' && (
                <div>
                    <label className="form-label small fw-bold">Payload (edit before sending):</label>
                    <textarea className="form-control font-monospace mb-2" rows={6} style={{ fontSize: '0.8rem' }}
                        value={payload} onChange={e => setPayload(e.target.value)} />
                    {error && <p className="text-danger small mb-1">{error}</p>}
                    <button className="btn btn-info btn-sm" onClick={handleEnroll}>Enroll Factor</button>
                </div>
            )}
            {status === 'running' && <div className="text-center py-2"><div className="spinner-border spinner-border-sm text-primary" /></div>}
            {status === 'done' && (
                <div>
                    <div className="text-success fw-bold small mb-1">&#10003; Factor enrolled successfully</div>
                    <pre className="json-pre">{fmtJson(result)}</pre>
                    <button className="btn btn-outline-secondary btn-sm mt-1" onClick={reset}>Enroll Another</button>
                </div>
            )}
            {status === 'error' && (
                <div>
                    <p className="text-danger small mb-1">&#10007; {error}</p>
                    <button className="btn btn-outline-secondary btn-sm" onClick={reset}>Try Again</button>
                </div>
            )}
        </div>
    );
};
