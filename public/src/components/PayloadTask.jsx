// Generic payload task (reusable for update tasks)
const PayloadTask = ({ url, method, buttonLabel, buttonColor, defaultPayload, onSuccess }) => {
    const [payload, setPayload] = React.useState(defaultPayload);
    const [status, setStatus] = React.useState('idle');
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);

    React.useEffect(() => { setPayload(defaultPayload); setStatus('idle'); setResult(null); setError(null); }, [defaultPayload]);

    const handleSubmit = async () => {
        let parsed;
        try { parsed = JSON.parse(payload); } catch { setError('Invalid JSON'); return; }
        setStatus('running'); setError(null);
        const fetchFn = method === 'POST' ? apiPost : (u, b) => api(u, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
        const { ok, data } = await fetchFn(url, parsed);
        if (ok) { setStatus('done'); setResult(data); if (onSuccess) onSuccess(data); }
        else { setStatus('error'); setError(data); }
    };

    const reset = () => { setStatus('idle'); setResult(null); setError(null); setPayload(defaultPayload); };

    return (
        <div>
            <div className="mb-2 font-monospace small">
                <span className="badge bg-dark me-2">{method}</span>
                <code>{url}</code>
            </div>
            {status === 'idle' && (
                <div>
                    <textarea className="form-control font-monospace mb-2" rows={6} style={{ fontSize: '0.8rem' }}
                        value={payload} onChange={e => setPayload(e.target.value)} />
                    {error && <ApiError data={error} />}
                    <button className={`btn btn-${buttonColor} btn-sm`} onClick={handleSubmit}>{buttonLabel}</button>
                </div>
            )}
            {status === 'running' && <div className="text-center py-2"><div className="spinner-border spinner-border-sm text-primary" /></div>}
            {status === 'done' && (
                <div>
                    <div className="text-success fw-bold small mb-1">&#10003; Success</div>
                    <pre className="json-pre">{fmtJson(result)}</pre>
                    <button className="btn btn-outline-secondary btn-sm mt-1" onClick={reset}>Run Again</button>
                </div>
            )}
            {status === 'error' && (
                <div>
                    <ApiError data={error} />
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => { setStatus('idle'); setError(null); }}>Edit &amp; Retry</button>
                </div>
            )}
        </div>
    );
};
