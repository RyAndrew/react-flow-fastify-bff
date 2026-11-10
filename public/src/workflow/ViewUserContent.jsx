// All attributes for one identity: the identity itself next to the copy each system holds (Okta, SCIM),
// with values that differ from the identity highlighted; then the full Okta user object, the SCIM
// resource and the local DB row. Opening it reads Okta and SCIM live, which also refreshes the row's
// copies and synced times, so the row is read again afterwards.
// `user` is the local row the node was created with.
const ViewUserContent = ({ onClose, onUserChanged, user }) => {
    const [local, setLocal] = React.useState(null);
    const [okta, setOkta] = React.useState(null);   // Okta user object | error response
    const [scim, setScim] = React.useState(null);   // SCIM user resource | error response
    const [attributes, setAttributes] = React.useState([]);
    const [localError, setLocalError] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        api('/api/v1/identities/attributes').then(({ ok, data }) => ok && setAttributes(data.attributes));
    }, []);

    const readLocal = async () => {
        const res = await api(`/api/v1/users/local/${user.id}`);
        if (!res.ok) { setLocalError(res.data); return null; }
        setLocal(res.data.user);
        onUserChanged(res.data.user.id, res.data.user);
        return res.data.user;
    };

    const load = async () => {
        setLoading(true); setLocalError(null); setOkta(null); setScim(null);
        const row = (await readLocal()) || user;
        if (!local) setLocal(row);

        await Promise.all([
            row.okta_id && api(`/api/v1/users/${encodeURIComponent(row.okta_id)}`)
                .then(({ ok, data }) => setOkta({ ok, value: ok ? data.user : data })),
            row.scim_id && row.scim_server_id && api(`/api/v1/scim/Users/${encodeURIComponent(row.scim_id)}`, {
                headers: { 'X-Scim-Server-Id': String(row.scim_server_id) },
            }).then(({ ok, data }) => setScim({ ok, value: ok ? data : { error: 'SCIM server error', details: data } })),
        ]);
        if (row.okta_id || row.scim_id) await readLocal();
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
                {loading && !local ? (
                    <div className="text-center py-3"><div className="spinner-border text-primary" /></div>
                ) : (
                    <>
                        {local && <IdentityComparison row={local} attributes={attributes} />}
                        {loading && <div className="text-muted small mb-3"><span className="spinner-border spinner-border-sm me-1" />Reading Okta / SCIM…</div>}
                        <div className="mb-4">
                            <h6 className="fw-bold">Okta {okta?.ok && <StatusBadge status={okta.value.status} />}</h6>
                            {!local?.okta_id && <p className="small text-muted mb-0">No Okta credential.</p>}
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

// Identity | Okta | SCIM per identity attribute, from the row's identity / okta_identity / scim_identity
// (the server maps each system's copy to identity names). A system value that differs is highlighted.
const IdentityComparison = ({ row, attributes }) => {
    const systems = [
        row.okta_id && { key: 'okta', label: 'Okta', values: row.okta_identity, changedAt: row.okta_last_updated },
        row.scim_id && { key: 'scim', label: 'SCIM', values: row.scim_identity, changedAt: row.scim_last_modified },
    ].filter(Boolean);
    const identity = row.identity || {};
    const keys = (attributes.length ? attributes : Object.keys(identity))
        .filter(k => identity[k] !== undefined || systems.some(s => s.values?.[k] !== undefined));
    const differs = systems.map(s => s.values ? keys.filter(k => (s.values[k] ?? '') !== (identity[k] ?? '')).length : 0);

    return (
        <div className="mb-4">
            <h6 className="fw-bold">Identity vs credentials</h6>
            <table className="table table-sm table-bordered mb-1">
                <thead className="table-light">
                    <tr>
                        <th style={{ width: '20%' }}>Attribute</th>
                        <th>
                            Identity
                            <div className="small fw-normal text-muted">changed {fmtAgo(row.identity_updated_at)}</div>
                        </th>
                        {systems.map((s, i) => (
                            <th key={s.key}>
                                {s.label}{differs[i] > 0 && <span className="badge bg-warning text-dark ms-1">{differs[i]} differ</span>}
                                <div className="small fw-normal"><SyncInfo user={row} system={s.key} /></div>
                                {s.changedAt && <div className="small fw-normal text-muted" title={fmtTime(s.changedAt)}>changed there {fmtAgo(s.changedAt)}</div>}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {keys.map(k => (
                        <tr key={k}>
                            <td className="small font-monospace">{k}</td>
                            <td className="small" style={{ wordBreak: 'break-all' }}>{identity[k] ?? '—'}</td>
                            {systems.map(s => {
                                if (!s.values) return <td key={s.key} className="small text-muted">not synced yet</td>;
                                const v = s.values[k];
                                return <td key={s.key} className={`small ${(v ?? '') !== (identity[k] ?? '') ? 'table-warning' : ''}`} style={{ wordBreak: 'break-all' }}>{v ?? '—'}</td>;
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            {!systems.length && <p className="small text-muted mb-0">No credentials yet: this identity is only in the local database.</p>}
        </div>
    );
};
