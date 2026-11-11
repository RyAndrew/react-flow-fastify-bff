// The create payload of one credential (Okta user or SCIM/AD user) for an identity: built by the BFF from
// the identity through the shared attribute map, then given the initial status. The payload stays editable,
// for test combinations the mapping doesn't produce. The parent owns payload and status and sends it.
//   target   'okta' | 'scim'
//   source   { id } (a stored identity) | { identity } (one not saved yet) | null (identity not valid yet)
const CredentialPayloadForm = ({ target, source, status, onStatusChange, payload, onPayloadChange, rows = 12 }) => {
    const [building, setBuilding] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [rebuild, setRebuild] = React.useState(0);
    const sourceKey = source ? JSON.stringify(source) : '';

    // Rebuild when the identity changes (debounced: an inline identity changes as it is typed). Discards edits.
    React.useEffect(() => {
        if (!source) return;
        let cancelled = false;
        const t = setTimeout(async () => {
            setBuilding(true);
            try {
                const body = await fetchCredentialPayload(target, source, status);
                if (!cancelled) { onPayloadChange(JSON.stringify(body, null, 2)); setError(null); }
            } catch (e) { if (!cancelled) setError(e.message); }
            if (!cancelled) setBuilding(false);
        }, source.identity ? 300 : 0);
        return () => { cancelled = true; clearTimeout(t); };
    }, [sourceKey, target, rebuild]);

    // Status only patches the current payload so edits survive; leave it alone if the JSON is mid-edit and invalid
    const selectStatus = (value) => {
        onStatusChange(value);
        try { onPayloadChange(JSON.stringify(applyUserStatus(target, JSON.parse(payload), value), null, 2)); } catch { }
    };

    return (
        <div>
            <label className="form-label small fw-bold">Initial status:</label>
            <select className="form-select form-select-sm mb-3" value={status} onChange={e => selectStatus(e.target.value)}>
                {USER_CREATE_STATUSES[target].map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <div className="d-flex justify-content-between align-items-end mb-1">
                <label className="form-label small fw-bold mb-0">
                    {CREDENTIAL_TARGETS[target]} payload (edit before sending):
                    {building && <span className="spinner-border spinner-border-sm ms-2" />}
                </label>
                <button className="btn btn-sm btn-outline-secondary" disabled={!source || building} onClick={() => setRebuild(n => n + 1)}>
                    ↻ Rebuild from identity
                </button>
            </div>
            {!source && <div className="text-muted small mb-1">Fix the identity above to build the payload.</div>}
            {error && <div className="text-danger small mb-1">⚠ {error}</div>}
            <textarea className="form-control font-monospace" rows={rows} style={{ fontSize: '0.8rem' }}
                value={payload} onChange={e => onPayloadChange(e.target.value)} />
        </div>
    );
};

// Pick the identity a new credential belongs to (a stored identity without one on this target — for SCIM,
// without an account on serverId — or a new identity typed inline), then the payload for it. Used by
// Create Credential (Okta) and the SCIM client.
// The parent owns identityId ('' = new identity), status and payload; with a new identity, the row is
// created by the BFF from what the system returns.
const CredentialCreateForm = ({ target, serverId, identityId, onIdentityIdChange, status, onStatusChange, payload, onPayloadChange, rows = 10 }) => {
    const [identities, setIdentities] = React.useState(null);
    const [newIdentity, setNewIdentity] = React.useState(null);
    const hasCredential = (u) => (target === 'okta' ? !!u.okta_id : !!scimAccountFor(u, serverId));

    React.useEffect(() => {
        setIdentities(null);
        api('/api/v1/users?scope=all').then(({ data }) => setIdentities((data.users || []).filter(u => !hasCredential(u))));
    }, [target, serverId]);

    const source = identityId ? { id: identityId } : (newIdentity ? { identity: newIdentity } : null);
    const selected = identities?.find(u => String(u.id) === String(identityId));

    return (
        <div>
            <label className="form-label small fw-bold">Identity:</label>
            <select className="form-select form-select-sm mb-3" value={identityId} onChange={e => onIdentityIdChange(e.target.value)}>
                <option value="">— new identity —</option>
                {identities?.map(u => (
                    <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.login || u.email}) · {u.source}
                    </option>
                ))}
            </select>
            {identityId && !identities && <div className="text-muted small mb-2">Loading identities…</div>}
            {identities && identityId && !selected && (
                <div className="text-warning-emphasis small mb-2">⚠ Identity {identityId} already has a {CREDENTIAL_TARGETS[target]} credential (or no longer exists): a new row will be created.</div>
            )}

            {!identityId && (
                <div className="border rounded p-2 mb-3 bg-light">
                    <IdentityForm onChange={setNewIdentity} rows={8} />
                    <div className="small text-muted mt-1">Saved as a new identity, from what {CREDENTIAL_TARGETS[target]} returns, when the credential is created.</div>
                </div>
            )}

            <CredentialPayloadForm target={target} source={source} status={status} onStatusChange={onStatusChange}
                payload={payload} onPayloadChange={onPayloadChange} rows={rows} />
        </div>
    );
};
