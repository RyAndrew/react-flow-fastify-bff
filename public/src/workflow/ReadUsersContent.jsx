// Actions offered for the selected user; each opens that step's modal with the user preselected
const READ_USER_ACTIONS = [
    { modal: 'update',    label: 'Update',              color: 'primary' },
    { modal: 'lifecycle', label: 'Lifecycle',           color: 'warning' },
    { modal: 'delete',    label: 'Deactivate / Delete', color: 'danger' },
];

const ReadUsersContent = ({ onClose, onOpenModal }) => {
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedId, setSelectedId] = React.useState('');

    const loadUsers = () => {
        setLoading(true);
        api('/api/v1/users').then(({ data }) => { setUsers(data.users || []); setLoading(false); });
    };
    React.useEffect(loadUsers, []);

    const selectedUser = users.find(u => u.okta_id === selectedId);

    return (
        <>
            <div className="modal-body">
                <div className="d-flex align-items-center gap-2 mb-2 p-2 bg-light border rounded" style={{ minHeight: '48px' }}>
                    {selectedUser ? (
                        <>
                            <span className="small fw-bold text-nowrap">{selectedUser.first_name} {selectedUser.last_name}</span>
                            <span className="small text-muted text-truncate">{selectedUser.email}</span>
                            <div className="ms-auto d-flex gap-2">
                                {READ_USER_ACTIONS.map(({ modal, label, color }) => (
                                    <button key={modal} className={`btn btn-${color} btn-sm text-nowrap`}
                                        onClick={() => onOpenModal(modal, { initialUserId: selectedId })}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <span className="small text-muted">Select a user to see available actions.</span>
                    )}
                    <button className={`btn btn-outline-secondary btn-sm text-nowrap${selectedUser ? '' : ' ms-auto'}`} onClick={loadUsers}>↻ Refresh</button>
                </div>

                {loading ? (
                    <div className="text-center py-3"><div className="spinner-border text-primary" /></div>
                ) : !users.length ? (
                    <div className="alert alert-warning mb-0">No users found. Create a user first.</div>
                ) : (
                    <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                        <table className="table table-sm table-hover mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th></th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Login</th>
                                    <th>Status</th>
                                    <th>Okta ID</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.okta_id}
                                        className={selectedId === u.okta_id ? 'table-active' : ''}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setSelectedId(selectedId === u.okta_id ? '' : u.okta_id)}>
                                        <td><input type="radio" className="form-check-input" readOnly checked={selectedId === u.okta_id} /></td>
                                        <td>{u.first_name} {u.last_name}</td>
                                        <td>{u.email}</td>
                                        <td>{u.login}</td>
                                        <td><StatusBadge status={u.status} /></td>
                                        <td><code className="small">{u.okta_id}</code></td>
                                        <td className="small text-nowrap">{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};
