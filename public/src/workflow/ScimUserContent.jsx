// SCIM operations for one local user, run in place from a user node or Read Users.
// The identity can have an account on each SCIM server. Finds the user on the chosen server (the
// account's stored scim_id, else userName = login/email),
// then offers Get / Patch / Set Password / Activate-Deactivate / Delete, or Create if not found.
// The local row is read from the DB on open and after every write (the BFF updates its SCIM accounts),
// and the canvas node is given the new row. Create and Patch start from the identity, mapped to SCIM by
// the BFF, so the SCIM user matches the Okta user built from the same identity.
const SCIM_USER_OPS = [
    { key: 'get',      label: 'Get',          color: 'info' },
    { key: 'patch',    label: 'Patch',        color: 'secondary' },
    { key: 'password', label: 'Set Password', color: 'dark' },
    { key: 'active',   label: 'Activate / Deactivate', color: 'warning' },
    { key: 'delete',   label: 'Delete',       color: 'danger' },
];

const ScimUserContent = ({ onClose, onOpenScim, onUserChanged, user: initialUser }) => {
    const [user, setUser] = React.useState(null);              // local users row, from the DB
    const [userError, setUserError] = React.useState(null);
    const [servers, setServers] = React.useState([]);
    const [serverId, setServerId] = React.useState(initialUser.scim_accounts?.[0] ? String(initialUser.scim_accounts[0].scim_server_id) : '');
    const [resolving, setResolving] = React.useState(false);
    const [scimUser, setScimUser] = React.useState(null);   // SCIM resource, or null when not found
    const [resolveError, setResolveError] = React.useState(null);
    const [op, setOp] = React.useState('get');
    const [payload, setPayload] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirm, setConfirm] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [running, setRunning] = React.useState(false);
    const [result, setResult] = React.useState(null);       // { ok, status, data }
    const [createStatus, setCreateStatus] = React.useState(DEFAULT_CREATE_STATUS.scim);

    React.useEffect(() => {
        fetchLocalUser(initialUser.id).then(row => (row ? setUser(row) : setUserError({ error: `Local user ${initialUser.id} not found` })));
        api('/api/v1/scim-servers').then(({ data }) => {
            const list = data.servers || [];
            setServers(list);
            if (!serverId && list.length) setServerId(String(list[0].id));
        });
    }, []);

    // After a write the BFF has updated the row it reports: re-read it and pass it to the canvas
    const reloadUser = async (localUserId) => {
        if (!localUserId) return;
        const row = await fetchLocalUser(localUserId);
        if (row) { setUser(row); onUserChanged(row.id, row); }
    };

    const userName = user ? (user.login || user.email) : '';

    const resolve = async (sid = serverId) => {
        if (!sid || !user) return;
        setResolving(true); setResolveError(null); setScimUser(null);
        let res;
        const account = scimAccountFor(user, sid);
        if (account) {
            res = await scimRequest(sid, 'GET', `Users/${encodeURIComponent(account.scim_id)}`);
            if (res.ok) setScimUser(res.data);
        } else {
            for (const name of [...new Set([userName, user.email])]) {
                res = await scimRequest(sid, 'GET', `Users?filter=${encodeURIComponent(`userName eq "${name}"`)}&count=1`);
                if (!res.ok || res.data?.Resources?.length) break;
            }
            if (res.ok) setScimUser(res.data?.Resources?.[0] || null);
        }
        if (!res.ok && res.status !== 404) setResolveError(res.data);
        setResolving(false);
    };

    // Resolve once the row is loaded and whenever the server changes (not on every row reload)
    const userLoaded = !!user;
    React.useEffect(() => { setResult(null); setOp('get'); resolve(serverId); }, [serverId, userLoaded]);

    // Prefill per operation from the resolved user (not clearing result: it changes after a successful op)
    React.useEffect(() => {
        setPassword(''); setConfirm(''); setShowPassword(false);
        // Create (no SCIM user) is filled by CredentialPayloadForm; Patch replaces every attribute with the identity's
        if (scimUser && op === 'patch') {
            apiPost('/api/v1/identities/payload/scim', { id: user.id }).then(({ ok, data }) => {
                setPayload(ok ? JSON.stringify(buildScimReplacePatch(data.payload), null, 2) : JSON.stringify(buildScimUserPatchFrom(scimUser, user), null, 2));
            });
        }
    }, [op, scimUser]);

    // path defaults to this SCIM user (or Users for a create)
    const run = async (method, body, path = scimUser ? `Users/${encodeURIComponent(scimUser.id)}` : 'Users') => {
        setRunning(true); setResult(null);
        let res;
        try { res = await scimRequest(serverId, method, path, body); }
        catch (e) { res = { ok: false, status: 0, data: e.message || 'Request failed' }; }
        setRunning(false);
        setResult(res);
        if (!res.ok) return res;
        if (method === 'DELETE') setScimUser(null);
        else if (res.data?.id) setScimUser(res.data);   // POST/PATCH return the updated resource
        else resolve();                                  // 204 from PATCH: re-read
        await reloadUser(res.localUserId);
        return res;
    };

    const runPayload = (method, path) => {
        let body;
        try { body = JSON.parse(payload); } catch { setResult({ ok: false, data: 'Invalid JSON payload' }); return; }
        return run(method, body, path);
    };

    // Create, linked to this local row so later lookups use the SCIM id, not userName
    const runCreate = () => runPayload('POST', `Users?localId=${encodeURIComponent(user.id)}`);

    const runPassword = () => {
        if (!password) { setResult({ ok: false, data: 'Please enter a new password' }); return; }
        if (password !== confirm) { setResult({ ok: false, data: 'Passwords do not match' }); return; }
        run('PATCH', buildScimPasswordPatch(password)).then(res => {
            if (res.ok) { setPassword(''); setConfirm(''); setShowPassword(false); }
        });
    };

    const isActive = scimUser?.active !== false;
    const scimRows = scimUser ? flattenObject(scimUser).filter(([k]) => k !== 'meta.location') : [];

    if (userError) return <div className="modal-body"><ApiError data={userError} /></div>;
    if (!user) return <div className="modal-body text-center py-3"><div className="spinner-border spinner-border-sm text-primary" /></div>;

    return (
        <>
            <div className="modal-body">
                <div className="d-flex align-items-center gap-2 mb-3 p-2 bg-light border rounded">
                    <label className="form-label mb-0 small fw-bold text-nowrap">SCIM Server:</label>
                    <select className="form-select form-select-sm" value={serverId} onChange={e => setServerId(e.target.value)}>
                        {!servers.length && <option value="">— no servers configured —</option>}
                        {servers.map(s => <option key={s.id} value={s.id}>{scimAccountFor(user, s.id) ? '✓ ' : ''}{s.name} — {s.url}</option>)}
                    </select>
                    {scimUser && (
                        <button className="btn btn-link btn-sm text-nowrap"
                            onClick={() => onOpenScim({ resourceType: 'Users', action: 'get', requiresUser: false, scimId: scimUser.id, serverId })}>
                            Open in SCIM client ↗
                        </button>
                    )}
                </div>

                {resolving ? (
                    <div className="text-muted small mb-3"><span className="spinner-border spinner-border-sm me-1" />Looking up <code>{userName}</code>…</div>
                ) : resolveError ? (
                    <div className="mb-3"><ApiError data={resolveError} /></div>
                ) : scimUser ? (
                    <>
                        <div className="small mb-3">
                            Found <code>{scimUser.userName}</code> · id <code>{scimUser.id}</code>{' '}
                            {isActive ? <span className="badge bg-success">active</span> : <span className="badge bg-secondary">inactive</span>}
                        </div>
                        <div className="d-flex flex-wrap gap-2 mb-3">
                            {SCIM_USER_OPS.map(o => (
                                <button key={o.key} className={`btn btn-sm ${op === o.key ? `btn-${o.color}` : `btn-outline-${o.color}`}`}
                                    onClick={() => { setOp(o.key); setResult(null); }}>{o.label}</button>
                            ))}
                        </div>

                        {op === 'get' && (
                            <>
                                <div className="d-flex justify-content-end mb-2">
                                    <button className="btn btn-outline-secondary btn-sm" onClick={() => resolve()}>↻ Refresh</button>
                                </div>
                                <div style={{ maxHeight: '45vh', overflow: 'auto' }}><AttributeTable rows={scimRows} /></div>
                            </>
                        )}
                        {op === 'patch' && (
                            <div className="mb-2">
                                <label className="form-label small fw-bold">PatchOp body <span className="text-muted fw-normal">(prefilled: set every attribute to the identity's value)</span>:</label>
                                <textarea className="form-control font-monospace mb-2" rows={10} style={{ fontSize: '0.8rem' }}
                                    value={payload} onChange={e => setPayload(e.target.value)} />
                                <button className="btn btn-secondary btn-sm" disabled={running} onClick={() => runPayload('PATCH')}>Execute Patch</button>
                            </div>
                        )}
                        {op === 'password' && (
                            <>
                                <ScimPasswordFields password={password} confirm={confirm} show={showPassword}
                                    onPasswordChange={setPassword} onConfirmChange={setConfirm} onShowChange={setShowPassword} />
                                <button className="btn btn-dark btn-sm" disabled={running} onClick={runPassword}>Set Password</button>
                            </>
                        )}
                        {op === 'active' && (
                            <div className="mb-2">
                                <p className="small mb-2">This user is currently <strong>{isActive ? 'active' : 'inactive'}</strong> on the SCIM server.</p>
                                <button className={`btn btn-sm ${isActive ? 'btn-warning' : 'btn-success'}`} disabled={running}
                                    onClick={() => run('PATCH', { schemas: ['urn:ietf:params:scim:schemas:core:2.0:PatchOp'], Operations: [{ op: 'replace', path: 'active', value: !isActive }] })}>
                                    {isActive ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        )}
                        {op === 'delete' && (
                            <div className="mb-2">
                                <p className="small mb-2">Delete <code>{scimUser.userName}</code> from this SCIM server? The local record is kept.</p>
                                <button className="btn btn-danger btn-sm" disabled={running} onClick={() => run('DELETE')}>Delete from SCIM</button>
                            </div>
                        )}
                    </>
                ) : serverId ? (
                    <div className="mb-2">
                        <p className="small mb-2">No user with userName <code>{userName}</code> on this server. Create it:</p>
                        <CredentialPayloadForm target="scim" source={{ id: user.id }} payload={payload} onPayloadChange={setPayload}
                            status={createStatus} onStatusChange={setCreateStatus} rows={10} />
                        <button className="btn btn-success btn-sm mt-2" disabled={running} onClick={runCreate}>Create on SCIM</button>
                    </div>
                ) : null}

                {running && <div className="text-center py-2"><div className="spinner-border spinner-border-sm text-primary" /></div>}
                {result && !running && (
                    <div className="mt-3">
                        {result.ok ? (
                            <div className="text-success fw-bold small mb-1">
                                &#10003; Success {result.status && <span className="badge bg-success">{result.status}</span>}
                                {result.status === 204 && <span className="text-muted fw-normal"> — no content</span>}
                            </div>
                        ) : <ApiError data={result.data} />}
                        {result.ok && result.data && <pre className="json-pre">{fmtJson(result.data)}</pre>}
                    </div>
                )}
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};
