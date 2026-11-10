// Create Credential: an Okta user for an identity, either a stored one (picked, or the node it was opened
// from) or a new one typed inline. The payload comes from the identity through the shared attribute map.
const CreateCredentialContent = ({ onClose, onShowUser, initialIdentityId }) => {
    const [payload, setPayload] = React.useState('');
    const [status, setStatus] = React.useState('idle');
    const [progress, setProgress] = React.useState(0);
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [identityId, setIdentityId] = React.useState(initialIdentityId ? String(initialIdentityId) : '');
    const [userStatus, setUserStatus] = React.useState(DEFAULT_CREATE_STATUS.okta);

    const statusQuery = USER_CREATE_STATUSES.okta.find(s => s.value === userStatus).query;
    const createQs = new URLSearchParams({ ...statusQuery, ...(identityId ? { identityId } : {}) });
    const createUrl = `/api/v1/users/create?${createQs}`;

    const handleCreate = async () => {
        let parsed;
        try { parsed = JSON.parse(payload); } catch { setError('Invalid JSON'); return; }
        setStatus('running');
        setProgress(10);
        const t = setTimeout(() => setProgress(40), 300);

        const { ok, data } = await apiPost(createUrl, parsed);
        clearTimeout(t);

        if (ok) {
            setStatus('done'); setProgress(100); setResult(data.user);
            if (data.localUser) onShowUser(data.localUser);
        }
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
                {/* Kept mounted while running so a retry returns to the same payload */}
                <div style={{ display: status === 'idle' ? '' : 'none' }}>
                    <CredentialCreateForm target="okta" identityId={identityId} onIdentityIdChange={setIdentityId}
                        status={userStatus} onStatusChange={setUserStatus} payload={payload} onPayloadChange={setPayload} />
                    {typeof error === 'string' && <p className="text-danger mt-2 mb-0">{error}</p>}
                </div>
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
                        <div className="text-success fw-bold mb-2">&#10003; Okta credential created</div>
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
                {status === 'idle' && <button className="btn btn-success" disabled={!payload} onClick={handleCreate}>Create Okta Credential</button>}
                {status === 'error' && <button className="btn btn-outline-primary" onClick={() => { setStatus('idle'); setError(null); }}>Edit &amp; Retry</button>}
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};
