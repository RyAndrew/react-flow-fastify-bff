// Fields Okta returns from activate / reactivate / reset_password when sendEmail=false
const LIFECYCLE_LINK_FIELDS = [
    { key: 'activationUrl',    label: 'Activation URL' },
    { key: 'activationToken',  label: 'Activation token' },
    { key: 'resetPasswordUrl', label: 'Reset password URL' },
];

const CopyField = ({ label, value }) => {
    const [copied, setCopied] = React.useState(false);
    const copy = () => navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    });
    return (
        <div className="mb-2">
            <label className="form-label small fw-bold mb-1">{label}</label>
            <div className="input-group input-group-sm">
                <input className="form-control font-monospace" readOnly value={value} onFocus={e => e.target.select()} />
                <button className="btn btn-outline-secondary" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
        </div>
    );
};

const LifecycleContent = ({ onClose, initialUserId, onUserChanged }) => {
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedId, setSelectedId] = React.useState(initialUserId || '');
    const [sendEmail, setSendEmail] = React.useState(false);
    const [running, setRunning] = React.useState(null);
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);

    const loadUsers = () => {
        api('/api/v1/users').then(({ data }) => { setUsers(data.users || []); setLoading(false); });
    };
    React.useEffect(loadUsers, []);

    const handleAction = async ({ action, sendsEmail }) => {
        if (!selectedId) return;
        setRunning(action);
        setResult(null);
        setError(null);

        const qs = sendsEmail ? `?sendEmail=${sendEmail}` : '';
        const { ok, data } = await apiPost(`/api/v1/users/${selectedId}/lifecycle/${action}${qs}`, {});
        setRunning(null);
        if (ok) {
            setResult({ action, user: data.user, links: data.result });
            if (data.localUser) onUserChanged(data.localUser.id, data.localUser);
            loadUsers();
        } else {
            setError(data);
        }
    };

    const links = result?.links ? LIFECYCLE_LINK_FIELDS.filter(f => result.links[f.key]) : [];

    return (
        <>
            <div className="modal-body">
                <UserPicker users={users} selectedId={selectedId} onChange={v => { setSelectedId(v); setResult(null); setError(null); }} loading={loading} />
                {selectedId && (
                    <>
                        <div className="form-check form-switch mb-2">
                            <input className="form-check-input" type="checkbox" id="lifecycle-send-email"
                                checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} />
                            <label className="form-check-label small" htmlFor="lifecycle-send-email">
                                Send Okta email for activate / reactivate / reset password
                                <span className="text-muted"> — off: Okta returns the link here instead</span>
                            </label>
                        </div>
                        <div className="d-flex flex-wrap gap-2 mb-3">
                            {LIFECYCLE_ACTIONS.map((a) => (
                                <button key={a.action} className={`btn btn-${a.color} btn-sm`}
                                    disabled={!!running} onClick={() => handleAction(a)}
                                    title={a.sendsEmail ? (sendEmail ? 'Okta will email the user' : 'No email — link returned') : undefined}>
                                    {running === a.action ? <span className="spinner-border spinner-border-sm" /> : a.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
                {result && (
                    <div>
                        <div className="text-success fw-bold mb-2">&#10003; {result.action} completed</div>
                        {links.length > 0 && (
                            <div className="alert alert-warning py-2">
                                <div className="small mb-2">
                                    One-time link — give it to the user over a channel you trust. It acts as a credential until it is redeemed or expires,
                                    and running reactivate / reset again invalidates it.
                                </div>
                                {links.map(f => <CopyField key={f.key} label={f.label} value={result.links[f.key]} />)}
                            </div>
                        )}
                        <pre className="json-pre">{fmtJson(result.user)}</pre>
                    </div>
                )}
                {error && <ApiError data={error} />}
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};
