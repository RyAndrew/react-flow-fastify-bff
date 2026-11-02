// Deactivate + Delete
const DeleteContent = ({ onClose, initialUserId }) => {
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedId, setSelectedId] = React.useState(initialUserId || '');
    const [running, setRunning] = React.useState(null);
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);

    const loadUsers = () => {
        api('/api/v1/users').then(({ data }) => { setUsers(data.users || []); setLoading(false); });
    };
    React.useEffect(loadUsers, []);

    const handleDeactivate = async () => {
        if (!selectedId) return;
        setRunning('deactivate'); setResult(null); setError(null);
        const { ok, data } = await apiPost(`/api/v1/users/${selectedId}/deactivate`, {});
        setRunning(null);
        if (ok) { setResult({ action: 'deactivate', data }); loadUsers(); }
        else { setError(data.details?.errorSummary || data.error || 'Deactivate failed'); }
    };

    const handleDelete = async () => {
        if (!selectedId) return;
        setRunning('delete'); setResult(null); setError(null);
        const { ok, data } = await api(`/api/v1/users/${selectedId}`, { method: 'DELETE' });
        setRunning(null);
        if (ok) { setResult({ action: 'delete', data }); setSelectedId(''); loadUsers(); }
        else { setError(data.details?.errorSummary || data.error || 'Delete failed — user may need to be deactivated first'); }
    };

    const selectedUser = users.find(u => u.okta_id === selectedId);

    return (
        <>
            <div className="modal-body">
                <UserPicker users={users} selectedId={selectedId} onChange={v => { setSelectedId(v); setResult(null); setError(null); }} loading={loading} />
                {selectedId && (
                    <div className="d-flex gap-2 mb-3">
                        <button className="btn btn-warning" disabled={!!running} onClick={handleDeactivate}>
                            {running === 'deactivate' ? <span className="spinner-border spinner-border-sm" /> : 'Deactivate'}
                        </button>
                        <button className="btn btn-danger" disabled={!!running} onClick={handleDelete}>
                            {running === 'delete' ? <span className="spinner-border spinner-border-sm" /> : 'Delete'}
                        </button>
                    </div>
                )}
                {selectedId && selectedUser && (
                    <p className="small text-muted">Current status: <StatusBadge status={selectedUser.status} /></p>
                )}
                {result && <div className="text-success fw-bold">&#10003; {result.action} completed</div>}
                {error && <p className="text-danger">&#10007; {error}</p>}
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};
