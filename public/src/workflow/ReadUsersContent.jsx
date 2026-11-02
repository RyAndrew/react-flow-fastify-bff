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
        api('/api/v1/users?scope=all').then(({ data }) => { setUsers(data.users || []); setLoading(false); });
    };
    React.useEffect(loadUsers, []);

    // selectedId is the local row id: SCIM imports not yet created in Okta have no okta_id
    const selectedUser = users.find(u => u.id === selectedId);

    return (
        <>
            <div className="modal-body">
                <div className="d-flex align-items-center gap-2 mb-2 p-2 bg-light border rounded" style={{ minHeight: '48px' }}>
                    {selectedUser ? (
                        <>
                            <span className="small fw-bold text-nowrap">{selectedUser.first_name} {selectedUser.last_name}</span>
                            <span className="small text-muted text-truncate">{selectedUser.email}</span>
                            <div className="ms-auto d-flex gap-2">
                                {/* SCIM import not yet in Okta: offer Create, prefilled from the import */}
                                {selectedUser.source === 'scim' && !selectedUser.okta_id && (
                                    <button className="btn btn-success btn-sm text-nowrap"
                                        onClick={() => onOpenModal('create', { initialImportedId: selectedUser.id })}>
                                        Create
                                    </button>
                                )}
                                {READ_USER_ACTIONS.map(({ modal, label, color }) => (
                                    <button key={modal} className={`btn btn-${color} btn-sm text-nowrap`}
                                        disabled={!selectedUser.okta_id}
                                        title={selectedUser.okta_id ? '' : 'Not in Okta yet — create it from the Create User node'}
                                        onClick={() => onOpenModal(modal, { initialUserId: selectedUser.okta_id })}>
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
                                    <th>Source</th>
                                    <th>Okta ID</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}
                                        className={selectedId === u.id ? 'table-active' : ''}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setSelectedId(selectedId === u.id ? '' : u.id)}>
                                        <td><input type="radio" className="form-check-input" readOnly checked={selectedId === u.id} /></td>
                                        <td>{u.first_name} {u.last_name}</td>
                                        <td>{u.email}</td>
                                        <td>{u.login}</td>
                                        <td>{u.status ? <StatusBadge status={u.status} /> : '—'}</td>
                                        <td><span className="badge bg-light text-dark border">{u.source}</span></td>
                                        <td>{u.okta_id ? <code className="small">{u.okta_id}</code> : '—'}</td>
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
