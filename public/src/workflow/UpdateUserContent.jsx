const UPDATE_TASKS = [
    { key: 'profile', label: 'Update Profile' },
    { key: 'password', label: 'Update Password' },
    { key: 'factor', label: 'Enroll Authenticator' },
    { key: 'group', label: 'Add to Group' },
];

const UpdateUserContent = ({ onClose }) => {
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedId, setSelectedId] = React.useState('');
    const [activeTask, setActiveTask] = React.useState('profile');

    React.useEffect(() => {
        api('/api/v1/users').then(({ data }) => { setUsers(data.users || []); setLoading(false); });
    }, []);

    const selectedUser = users.find(u => u.okta_id === selectedId);

    const profilePayload = selectedUser ? JSON.stringify({
        profile: {
            firstName: selectedUser.first_name,
            lastName: selectedUser.last_name,
            email: selectedUser.email,
            mobilePhone: '555-555-0100',
        }
    }, null, 2) : '';

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
                                defaultPayload={profilePayload}
                            />
                        )}
                        {activeTask === 'password' && (
                            <PayloadTask
                                url={`/api/v1/users/${selectedId}/update`}
                                method="POST" buttonLabel="Set Password" buttonColor="warning"
                                defaultPayload={passwordPayload}
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
