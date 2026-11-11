// Table of SCIM users from a list/get response, each with buttons to save it to the local DB
// and to show it as a node on the canvas (which saves it first)
const ScimUserResults = ({ response, serverId, onShowUser, onGoToCanvas }) => {
    const users = response?.Resources || (response?.userName ? [response] : []);
    const [savedIds, setSavedIds] = React.useState(new Set()); // scim ids already in the local DB for this server
    const [saving, setSaving] = React.useState({}); // scimId → 'running' | 'done' | error response

    React.useEffect(() => {
        setSaving({});
        if (!serverId) { setSavedIds(new Set()); return; }
        api(`/api/v1/users?scim_server_id=${encodeURIComponent(serverId)}`).then(({ data }) => {
            setSavedIds(new Set((data.users || [])
                .map(u => scimAccountFor(u, serverId)?.scim_id)
                .filter(Boolean)));
        });
    }, [response, serverId]);

    if (!users.length) return null;

    // Returns the local users row on success, null on failure
    const handleSave = async (scimId) => {
        setSaving(s => ({ ...s, [scimId]: 'running' }));
        const { ok, data } = await api(`/api/v1/scim/Users/${encodeURIComponent(scimId)}/import`, {
            method: 'POST',
            headers: { 'X-Scim-Server-Id': serverId },
        });
        if (ok) {
            setSaving(s => ({ ...s, [scimId]: 'done' }));
            setSavedIds(ids => new Set(ids).add(scimId));
            return data.user;
        }
        setSaving(s => ({ ...s, [scimId]: data }));
        return null;
    };

    const handleShow = async (scimId) => {
        const user = await handleSave(scimId);
        if (user) { onShowUser(user); onGoToCanvas(); }
    };

    return (
        <div className="mb-3" style={{ maxHeight: '40vh', overflow: 'auto' }}>
            <table className="table table-sm table-hover mb-0">
                <thead className="table-light">
                    <tr><th>userName</th><th>Name</th><th>Email</th><th>Active</th><th style={{ width: '200px' }}></th></tr>
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
                                    <button className="btn btn-sm btn-outline-dark ms-1" title="Save to DB and add as a node on the canvas"
                                        disabled={state === 'running'} onClick={() => handleShow(u.id)}>
                                        Show
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
