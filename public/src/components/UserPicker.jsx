const UserPicker = ({ users, selectedId, onChange, loading }) => {
    if (loading) return <div className="text-center"><div className="spinner-border spinner-border-sm" /></div>;
    if (!users.length) return <div className="alert alert-warning mb-0">No users found. Create a user first.</div>;
    return (
        <select className="form-select mb-3" value={selectedId || ''} onChange={e => onChange(e.target.value)}>
            <option value="">Select a user...</option>
            {users.map(u => (
                <option key={u.okta_id} value={u.okta_id}>
                    {u.first_name} {u.last_name} ({u.email}) — {u.status}
                </option>
            ))}
        </select>
    );
};
