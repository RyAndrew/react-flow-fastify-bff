const CreateUserContent = ({ onClose, initialImportedId }) => {
    const ts = Date.now();
    const [payload, setPayload] = React.useState(JSON.stringify({
        profile: {
            firstName: 'Test',
            lastName: 'User',
            email: `testuser+${ts}@example.com`,
            login: `testuser+${ts}@example.com`,
        },
    }, null, 2));
    const [status, setStatus] = React.useState('idle');
    const [progress, setProgress] = React.useState(0);
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [scimImports, setScimImports] = React.useState([]);
    const [importedId, setImportedId] = React.useState('');

    React.useEffect(() => {
        api('/api/v1/users?source=scim').then(({ data }) => {
            const list = data.users || [];
            setScimImports(list);
            if (initialImportedId) selectImport(String(initialImportedId), list);
        });
    }, []);

    // Prefill the payload from a SCIM import; on create the server links that row to the new Okta user
    const selectImport = (id, list) => {
        setImportedId(id);
        const u = list.find(x => String(x.id) === id);
        if (!u) return;
        setPayload(JSON.stringify({
            profile: {
                firstName: u.first_name || '',
                lastName: u.last_name || '',
                email: u.email,
                login: u.login?.includes('@') ? u.login : u.email,
            },
        }, null, 2));
    };

    const createUrl = `/api/v1/users/create${importedId ? `?importedId=${importedId}` : ''}`;

    const handleCreate = async () => {
        let parsed;
        try { parsed = JSON.parse(payload); } catch { setError('Invalid JSON'); return; }
        setStatus('running');
        setProgress(10);
        const t = setTimeout(() => setProgress(40), 300);

        const { ok, data } = await apiPost(createUrl, parsed);
        clearTimeout(t);

        if (ok) { setStatus('done'); setProgress(100); setResult(data.user); }
        else { setStatus('error'); setProgress(100); setError(data); }
    };

    const barClass = status === 'error' ? 'progress-bar bg-danger'
        : status === 'done' ? 'progress-bar bg-success'
        : 'progress-bar progress-bar-striped progress-bar-animated';

    return (
        <>
            <div className="modal-body">
                <div className="mb-2 font-monospace small">
                    <span className="badge bg-dark me-2">POST</span>
                    <code>{createUrl}</code>
                </div>
                {status === 'idle' && (
                    <div>
                        <label className="form-label small fw-bold">Prefill from SCIM import (optional):</label>
                        <select className="form-select form-select-sm mb-3" value={importedId} onChange={e => selectImport(e.target.value, scimImports)}
                            disabled={!scimImports.length}>
                            <option value="">{scimImports.length ? '— none —' : 'No users imported via SCIM yet'}</option>
                            {scimImports.map(u => (
                                <option key={u.id} value={u.id} disabled={!!u.okta_id}>
                                    {u.first_name} {u.last_name} ({u.login || u.email}){u.okta_id ? ' — already in Okta' : ''}
                                </option>
                            ))}
                        </select>
                        <label className="form-label small fw-bold">Payload (edit before sending):</label>
                        <textarea className="form-control font-monospace" rows={10} style={{ fontSize: '0.8rem' }}
                            value={payload} onChange={e => setPayload(e.target.value)} />
                        {typeof error === 'string' && <p className="text-danger mt-2 mb-0">{error}</p>}
                    </div>
                )}
                {status === 'running' && (
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" role="status" />
                        <div className="progress mb-2">
                            <div className={barClass} style={{ width: `${progress}%`, transition: 'width 0.3s' }}></div>
                        </div>
                        <p className="text-muted mb-0">Calling downstream API...</p>
                    </div>
                )}
                {status === 'done' && result && (
                    <div>
                        <div className="text-success fw-bold mb-2">&#10003; User created successfully</div>
                        <pre className="json-pre">{fmtJson(result)}</pre>
                    </div>
                )}
                {status === 'error' && status !== 'idle' && (
                    <div>
                        <div className="text-danger fw-bold mb-2">&#10007; Failed</div>
                        <div className="progress mb-2"><div className="progress-bar bg-danger" style={{ width: '100%' }}></div></div>
                        <ApiError data={error} />
                    </div>
                )}
            </div>
            <div className="modal-footer">
                {status === 'idle' && <button className="btn btn-success" onClick={handleCreate}>Create User</button>}
                {status === 'error' && <button className="btn btn-outline-primary" onClick={() => { setStatus('idle'); setError(null); }}>Edit &amp; Retry</button>}
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};
