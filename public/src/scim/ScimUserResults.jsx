// Table of SCIM users from a list/get response, each with a button to save it to the local DB
const ScimUserResults = ({ response, serverId }) => {
    const users = response?.Resources || (response?.userName ? [response] : []);
    const [savedIds, setSavedIds] = React.useState(new Set()); // scim ids already in the local DB for this server
    const [saving, setSaving] = React.useState({}); // scimId → 'running' | 'done' | error response

    React.useEffect(() => {
        setSaving({});
        api('/api/v1/users?source=scim').then(({ data }) => {
            setSavedIds(new Set((data.users || [])
                .filter(u => String(u.scim_server_id) === String(serverId))
                .map(u => u.scim_id)));
        });
    }, [response, serverId]);

    if (!users.length) return null;

    const handleSave = async (scimId) => {
        setSaving(s => ({ ...s, [scimId]: 'running' }));
        const { ok, data } = await api(`/api/v1/scim/Users/${encodeURIComponent(scimId)}/import`, {
            method: 'POST',
            headers: { 'X-Scim-Server-Id': serverId },
        });
        if (ok) {
            setSaving(s => ({ ...s, [scimId]: 'done' }));
            setSavedIds(ids => new Set(ids).add(scimId));
        } else {
            setSaving(s => ({ ...s, [scimId]: data }));
        }
    };

    return (
        <div className="mb-3" style={{ maxHeight: '40vh', overflow: 'auto' }}>
            <table className="table table-sm table-hover mb-0">
                <thead className="table-light">
                    <tr><th>userName</th><th>Name</th><th>Email</th><th>Active</th><th style={{ width: '130px' }}></th></tr>
                </thead>
                <tbody>
                    {users.map(u => {
                        const state = saving[u.id];
                        const inDb = savedIds.has(u.id);
                        const email = u.emails?.find(e => e.primary)?.value || u.emails?.[0]?.value;
                        return (
                            <tr key={u.id}>
                                <td className="small">{u.userName}</td>
                                <td className="small">{u.name?.givenName} {u.name?.familyName}</td>
                                <td className="small">{email || '—'}</td>
                                <td>{u.active === false ? <span className="badge bg-secondary">no</span> : <span className="badge bg-success">yes</span>}</td>
                                <td className="text-end">
                                    {inDb && state !== 'running' && <span className="badge bg-success me-1">In DB</span>}
                                    <button className={`btn btn-sm ${inDb ? 'btn-outline-secondary' : 'btn-success'}`}
                                        disabled={state === 'running'} onClick={() => handleSave(u.id)}>
                                        {state === 'running' ? <span className="spinner-border spinner-border-sm" /> : inDb ? 'Re-save' : 'Save to DB'}
                                    </button>
                                    {typeof state === 'object' && <ApiError data={state} compact />}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
