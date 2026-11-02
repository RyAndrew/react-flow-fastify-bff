const LifecycleContent = ({ onClose }) => {
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedId, setSelectedId] = React.useState('');
    const [running, setRunning] = React.useState(null);
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);

    const loadUsers = () => {
        api('/api/v1/users').then(({ data }) => { setUsers(data.users || []); setLoading(false); });
    };
    React.useEffect(loadUsers, []);

    const handleAction = async (action) => {
        if (!selectedId) return;
        setRunning(action);
        setResult(null);
        setError(null);

        const { ok, data } = await apiPost(`/api/v1/users/${selectedId}/lifecycle/${action}`, {});
        setRunning(null);
        if (ok) {
            setResult({ action, user: data.user });
            loadUsers();
        } else {
            setError(data.details?.errorSummary || data.error || `${action} failed`);
        }
    };

    return (
        <>
            <div className="modal-body">
                <UserPicker users={users} selectedId={selectedId} onChange={v => { setSelectedId(v); setResult(null); setError(null); }} loading={loading} />
                {selectedId && (
                    <div className="d-flex flex-wrap gap-2 mb-3">
                        {LIFECYCLE_ACTIONS.map(({ action, label, color }) => (
                            <button key={action} className={`btn btn-${color} btn-sm`}
                                disabled={!!running} onClick={() => handleAction(action)}>
                                {running === action ? <span className="spinner-border spinner-border-sm" /> : label}
                            </button>
                        ))}
                    </div>
                )}
                {result && (
                    <div>
                        <div className="text-success fw-bold mb-2">&#10003; {result.action} completed</div>
                        <pre className="json-pre">{fmtJson(result.user)}</pre>
                    </div>
                )}
                {error && <p className="text-danger">&#10007; {error}</p>}
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};
