// All attributes for one user: the full Okta user object (when it exists in Okta), the SCIM
// resource (when it came from a SCIM server) and the local DB row.
// `user` is the local row the node was created with; everything is re-fetched so the view is current.
const ViewUserContent = ({ onClose, onUserChanged, user }) => {
    const [local, setLocal] = React.useState(null);
    const [okta, setOkta] = React.useState(null);   // Okta user object | error response
    const [scim, setScim] = React.useState(null);   // SCIM user resource | error response
    const [localError, setLocalError] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    const load = async () => {
        setLoading(true); setLocalError(null); setOkta(null); setScim(null);
        const localRes = await api(`/api/v1/users/local/${user.id}`);
        const row = localRes.ok ? localRes.data.user : user;
        setLocal(row);
        if (localRes.ok) onUserChanged(row.id, row);
        else setLocalError(localRes.data);

        await Promise.all([
            row.okta_id && api(`/api/v1/users/${encodeURIComponent(row.okta_id)}`)
                .then(({ ok, data }) => setOkta({ ok, value: ok ? data.user : data })),
            row.scim_id && row.scim_server_id && api(`/api/v1/scim/Users/${encodeURIComponent(row.scim_id)}`, {
                headers: { 'X-Scim-Server-Id': String(row.scim_server_id) },
            }).then(({ ok, data }) => setScim({ ok, value: ok ? data : { error: 'SCIM server error', details: data } })),
        ]);
        setLoading(false);
    };
    React.useEffect(() => { load(); }, [user.id]);

    // _links (Okta) and meta.location (SCIM) are API navigation, not user attributes
    const oktaRows = okta?.ok ? flattenObject(okta.value).filter(([k]) => !k.startsWith('_links')) : [];
    const scimRows = scim?.ok ? flattenObject(scim.value).filter(([k]) => k !== 'meta.location') : [];

    return (
        <>
            <div className="modal-body">
                <div className="d-flex align-items-center mb-3">
                    <h6 className="mb-0">{user.first_name} {user.last_name} <span className="text-muted fw-normal">({user.email})</span></h6>
                    <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={load} disabled={loading}>↻ Refresh</button>
                </div>
                {loading ? (
                    <div className="text-center py-3"><div className="spinner-border text-primary" /></div>
                ) : (
                    <>
                        <div className="mb-4">
                            <h6 className="fw-bold">Okta {okta?.ok && <StatusBadge status={okta.value.status} />}</h6>
                            {!local?.okta_id && <p className="small text-muted mb-0">Not in Okta yet.</p>}
                            {okta && (okta.ok ? <AttributeTable rows={oktaRows} /> : <ApiError data={okta.value} />)}
                        </div>
                        {local?.scim_id && (
                            <div className="mb-4">
                                <h6 className="fw-bold">SCIM <span className="text-muted fw-normal small">server {local.scim_server_id} · id <code>{local.scim_id}</code></span></h6>
                                {scim && (scim.ok ? <AttributeTable rows={scimRows} /> : <ApiError data={scim.value} />)}
                            </div>
                        )}
                        <div>
                            <h6 className="fw-bold">Local database record</h6>
                            {localError && <ApiError data={localError} />}
                            {local && <AttributeTable rows={flattenObject(local)} />}
                        </div>
                    </>
                )}
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};
