const UPDATE_TASKS = [
    { key: 'profile', label: 'Update Profile' },
    { key: 'password', label: 'Update Password' },
    { key: 'factor', label: 'Enroll Authenticator' },
    { key: 'group', label: 'Add to Group' },
];

const UpdateUserContent = ({ onClose, initialUserId, onUserChanged }) => {
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedId, setSelectedId] = React.useState(initialUserId || '');
    const [activeTask, setActiveTask] = React.useState('profile');

    const loadUsers = () => api('/api/v1/users').then(({ data }) => { setUsers(data.users || []); setLoading(false); });
    React.useEffect(() => { loadUsers(); }, []);

    const selectedUser = users.find(u => u.okta_id === selectedId);

    // Starts from the stored row: core columns + every profile attribute, in Okta's profile names.
    // Rebuilt only when another user is picked: PayloadTask resets (hiding its result) when this changes.
    const profilePayload = React.useMemo(() => selectedUser ? JSON.stringify({
        profile: {
            firstName: selectedUser.first_name,
            lastName: selectedUser.last_name,
            email: selectedUser.email,
            login: selectedUser.login,
            ...selectedUser.profile,
        }
    }, null, 2) : '', [selectedId, loading]);

    // The BFF saved Okta's response to the local row: show it on the canvas and in the picker
    const handleSaved = (data) => {
        if (!data.localUser) return;
        onUserChanged(data.localUser.id, data.localUser);
        setUsers(us => us.map(u => u.id === data.localUser.id ? data.localUser : u));
    };

    const passwordPayload = JSON.stringify({
        credentials: {
            password: { value: 'NewP@ssw0rd!' },
        },
    }, null, 2);

    return (
        <>
            <div className="modal-body">
                <UserPicker users={users} selectedId={selectedId} onChange={v => { setSelectedId(v); setActiveTask('profile'); }} loading={loading} />
                {selectedId && (
                    <div>
                        <ul className="nav nav-tabs mb-3">
                            {UPDATE_TASKS.map(t => (
                                <li className="nav-item" key={t.key}>
                                    <button className={`nav-link ${activeTask === t.key ? 'active' : ''}`}
                                        onClick={() => setActiveTask(t.key)}>{t.label}</button>
                                </li>
                            ))}
                        </ul>
                        {activeTask === 'profile' && (
                            <PayloadTask
                                url={`/api/v1/users/${selectedId}/update`}
                                method="POST" buttonLabel="Update Profile" buttonColor="primary"
                                defaultPayload={profilePayload} onSuccess={handleSaved}
                            />
                        )}
                        {activeTask === 'password' && (
                            <PayloadTask
                                url={`/api/v1/users/${selectedId}/update`}
                                method="POST" buttonLabel="Set Password" buttonColor="warning"
                                defaultPayload={passwordPayload} onSuccess={handleSaved}
                            />
                        )}
                        {activeTask === 'factor' && (
                            <EnrollFactorContent userId={selectedId} />
                        )}
                        {activeTask === 'group' && (
                            <AddToGroupContent userId={selectedId} />
                        )}
                    </div>
                )}
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};
