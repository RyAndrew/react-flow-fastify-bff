const ScimClient = ({ preset, onClearPreset, serverId, onServerIdChange, onShowUser, onUserChanged, onGoToCanvas, onViewLogs }) => {
    const [servers, setServers] = React.useState([]);
    const [showServerMgr, setShowServerMgr] = React.useState(false);
    const [resourceType, setResourceType] = React.useState('Users');
    const [action, setAction] = React.useState('list');
    const [idInput, setIdInput] = React.useState('');
    const [filterInput, setFilterInput] = React.useState('');
    const [startIndex, setStartIndex] = React.useState('1');
    const [count, setCount] = React.useState('10');
    const [payload, setPayload] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [response, setResponse] = React.useState(null);
    const [httpStatus, setHttpStatus] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [canvasNotice, setCanvasNotice] = React.useState(null); // 'done' after a SCIM create saved to the DB and the canvas

    // Workflow user picker state (used when preset.requiresUser)
    const [workflowUsers, setWorkflowUsers] = React.useState([]);
    const [workflowUsersLoading, setWorkflowUsersLoading] = React.useState(false);
    const [selectedWorkflowUserId, setSelectedWorkflowUserId] = React.useState('');
    const [lookupLoading, setLookupLoading] = React.useState(false);
    const [lookupError, setLookupError] = React.useState(null);
    const [presetActive, setPresetActive] = React.useState(false); // true while a preset is in effect

    // Set Password state
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);

    // Create User state (identity picker + payload form)
    const [createStatus, setCreateStatus] = React.useState(DEFAULT_CREATE_STATUS.scim);
    const [createIdentityId, setCreateIdentityId] = React.useState('');

    const isSetPassword = action === 'setPassword';
    const isUserCreate = action === 'create' && resourceType === 'Users';
    const needsId      = ['get', 'replace', 'patch', 'setPassword', 'delete'].includes(action);
    const needsPayload = ['create', 'replace', 'patch'].includes(action);
    const needsFilter  = action === 'list';
    const method       = SCIM_ACTION_METHODS[action];

    // Load servers list
    const loadServers = () => {
        api('/api/v1/scim-servers').then(({ data }) => {
            const list = data.servers || [];
            setServers(list);
            // Auto-select if only one exists and nothing selected yet
            if (list.length === 1 && !serverId) onServerIdChange(String(list[0].id));
        });
    };
    React.useEffect(loadServers, []);

    // Apply preset from workflow navigation
    React.useEffect(() => {
        if (!preset) return;
        setResourceType(preset.resourceType || 'Users');
        setAction(preset.action);
        // Presets from a user node / Read Users target one known SCIM user on a known server
        setIdInput(preset.scimId || '');
        if (preset.serverId) onServerIdChange(String(preset.serverId));
        setResponse(null); setError(null); setHttpStatus(null); setCanvasNotice(null);
        setLookupError(null);
        setSelectedWorkflowUserId('');

        if (preset.patchOps) {
            setPayload(JSON.stringify({
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:PatchOp'],
                Operations: preset.patchOps,
            }, null, 2));
        } else if (['create', 'replace', 'patch'].includes(preset.action)) {
            setPayload(getScimDefaultPayload(preset.resourceType || 'Users', preset.action));
        } else {
            setPayload('');
        }

        // Patch for a known user: start from that user's current SCIM values
        if (preset.scimId && preset.action === 'patch' && !preset.patchOps) {
            api(`/api/v1/scim/Users/${encodeURIComponent(preset.scimId)}`, { headers: { 'X-Scim-Server-Id': String(preset.serverId) } })
                .then(({ ok, data }) => { if (ok) setPayload(JSON.stringify(buildScimUserPatchFrom(data), null, 2)); });
        }

        setPresetActive(!!preset.requiresUser);
        if (preset.requiresUser) {
            setWorkflowUsersLoading(true);
            api('/api/v1/users').then(({ data }) => {
                setWorkflowUsers(data.users || []);
                setWorkflowUsersLoading(false);
            });
        }
        onClearPreset();
    }, [preset]);

    // Reset payload when action/resourceType changes manually (not via preset)
    React.useEffect(() => {
        if (presetActive) return; // preset just applied, skip
        setResponse(null); setError(null); setHttpStatus(null);
        clearPasswordFields();
        setPayload(needsPayload ? getScimDefaultPayload(resourceType, action) : '');
    }, [action, resourceType]);

    // A Users create starts as a new identity; picking a stored one links the new SCIM user to that row
    React.useEffect(() => { if (isUserCreate) setCreateIdentityId(''); }, [isUserCreate]);

    // Look up SCIM user by local user's email/login when user is picked
    const handleWorkflowUserChange = async (oktaId) => {
        setSelectedWorkflowUserId(oktaId);
        setIdInput(''); setLookupError(null);
        if (!oktaId) return;
        const user = workflowUsers.find(u => u.okta_id === oktaId);
        if (!user || !serverId) return;

        setLookupLoading(true);
        const filter = `userName eq "${user.email}"`;
        const { ok, data } = await api(
            `/api/v1/scim/Users?filter=${encodeURIComponent(filter)}&count=1`,
            { headers: { 'X-Scim-Server-Id': serverId } }
        );
        setLookupLoading(false);

        const scimUser = ok && data.Resources?.[0];
        if (scimUser) {
            setIdInput(scimUser.id);
            // For generic patch (no patchOps), build an update patch from SCIM user data
            if (action === 'patch' && !payload.includes('"active"')) {
                setPayload(JSON.stringify(buildScimUserPatchFrom(scimUser, user), null, 2));
            }
        } else {
            setLookupError(`No SCIM user found matching "${user.email}" on selected server`);
        }
    };

    const buildUrl = () => {
        const base = `/api/v1/scim/${resourceType}`;
        if (needsId) return `${base}/${idInput || ':id'}`;
        if (needsFilter) {
            const qs = new URLSearchParams();
            if (filterInput.trim()) qs.set('filter', filterInput.trim());
            qs.set('startIndex', startIndex || '1');
            qs.set('count', count || '10');
            return `${base}?${qs.toString()}`;
        }
        // A create for a stored identity is linked to that row by the BFF
        if (isUserCreate && createIdentityId) return `${base}?localId=${encodeURIComponent(createIdentityId)}`;
        return base;
    };

    const handleExecute = async () => {
        if (!serverId) { setError('Please select a SCIM server'); return; }
        if (needsId && !idInput.trim()) { setError('Please enter a resource ID'); return; }
        if (isSetPassword) {
            if (!newPassword) { setError('Please enter a new password'); return; }
            if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
        }
        setLoading(true); setResponse(null); setError(null); setHttpStatus(null); setCanvasNotice(null);

        let body = null;
        if (isSetPassword) {
            body = buildScimPasswordPatch(newPassword);
        } else if (needsPayload) {
            try { body = JSON.parse(payload); }
            catch { setError('Invalid JSON payload'); setLoading(false); return; }
        }

        const url = buildUrl();
        const opts = {
            credentials: 'same-origin',
            method,
            headers: { 'X-Scim-Server-Id': serverId },
        };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }

        try {
            const res = await fetch(url, opts);
            setHttpStatus(res.status);
            // User writes also update the local row (the BFF reports which one): re-read it from the DB
            const localUserId = resourceType === 'Users' ? res.headers.get('X-Local-User-Id') : null;
            if (res.status === 204) {
                setResponse({ message: isSetPassword ? '204 No Content — password updated' : '204 No Content — resource deleted' });
                if (isSetPassword) clearPasswordFields();
                await applyLocalUser(localUserId);
                setLoading(false); return;
            }
            const text = await res.text();
            let data; try { data = JSON.parse(text); } catch { data = text || null; }
            if (res.ok && isSetPassword) clearPasswordFields();
            if (res.ok) setResponse(data);
            else setError(typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
            if (res.ok) await applyLocalUser(localUserId);
        } catch (e) {
            setError(e.message || 'Request failed');
        }
        setLoading(false);
    };

    // Like the Create User node, a created user is added to the canvas; any other write refreshes its node
    const applyLocalUser = async (localUserId) => {
        if (!localUserId) return;
        const row = await fetchLocalUser(localUserId);
        if (!row) return;
        if (isUserCreate) { onShowUser(row); setCanvasNotice('done'); }
        else onUserChanged(row.id, row);
    };

    const resetResult = () => { setResponse(null); setError(null); setHttpStatus(null); setCanvasNotice(null); };

    function clearPasswordFields() { setNewPassword(''); setConfirmPassword(''); setShowPassword(false); }

    const changeAction = (a) => {
        setAction(a); resetResult();
        setPresetActive(false); setPresetActive(false);
        // Reset user picker when manually changing action
        if (!presetActive) { setSelectedWorkflowUserId(''); setLookupError(null); setIdInput(''); }
    };

    const changeResourceType = (rt) => {
        setResourceType(rt); setAction('list'); resetResult();
        setPresetActive(false);
        setSelectedWorkflowUserId(''); setLookupError(null); setIdInput('');
    };

    const statusBadgeClass = httpStatus
        ? (httpStatus < 300 ? 'bg-success' : httpStatus < 500 ? 'bg-warning text-dark' : 'bg-danger')
        : 'bg-secondary';

    const selectedServer = servers.find(s => String(s.id) === String(serverId));

    return (
        <div style={{ height: 'calc(100vh - 56px)', overflow: 'auto' }}>
            {showServerMgr && (
                <ScimServerManager
                    onClose={() => setShowServerMgr(false)}
                    onChanged={loadServers}
                />
            )}
            <div className="container-fluid p-3">
                {/* ── Server selector bar ── */}
                <div className="d-flex align-items-center gap-2 mb-3 p-2 bg-light border rounded">
                    <label className="form-label mb-0 small fw-bold text-nowrap">SCIM Server:</label>
                    <select className="form-select form-select-sm"
                        value={serverId || ''}
                        onChange={e => onServerIdChange(e.target.value)}>
                        <option value="">— select a server —</option>
                        {servers.map(s => (
                            <option key={s.id} value={s.id}>{s.name} — {s.url}</option>
                        ))}
                    </select>
                    <button className="btn btn-outline-secondary btn-sm text-nowrap" onClick={() => setShowServerMgr(true)}>
                        Manage Servers
                    </button>
                    {/* Downstream URLs start with the server URL, so a text filter on it narrows to this server */}
                    <button className="btn btn-outline-primary btn-sm text-nowrap"
                        onClick={() => onViewLogs(selectedServer ? { label: `SCIM server ${selectedServer.name}`, filters: { scim: { q: selectedServer.url } } } : null)}>
                        📄 View Logs
                    </button>
                </div>

                <div className="row g-3">
                    {/* ── Left: controls ── */}
                    <div className="col-md-5">
                        {/* Resource type pills */}
                        <ul className="nav nav-pills mb-3">
                            {SCIM_RESOURCE_TYPES.map(rt => (
                                <li className="nav-item" key={rt}>
                                    <button className={`nav-link ${resourceType === rt ? 'active' : ''}`}
                                        onClick={() => changeResourceType(rt)}>
                                        {rt}
                                    </button>
                                </li>
                            ))}
                        </ul>

                        {/* Action buttons */}
                        <div className="mb-3 d-flex flex-wrap gap-2">
                            {SCIM_ACTIONS.filter(a => resourceType === 'Users' || !SCIM_USER_ONLY_ACTIONS.includes(a)).map(a => (
                                <button key={a}
                                    className={`btn btn-sm ${action === a ? `btn-${SCIM_ACTION_COLORS[a]}` : `btn-outline-${SCIM_ACTION_COLORS[a]}`}`}
                                    onClick={() => changeAction(a)}>
                                    <span className="badge bg-dark me-1" style={{ fontSize: '0.65rem' }}>{SCIM_ACTION_METHODS[a]}</span>
                                    {SCIM_ACTION_LABELS[a]}
                                </button>
                            ))}
                        </div>

                        {/* URL preview */}
                        <div className="mb-3 p-2 bg-light rounded font-monospace small border">
                            <span className="badge bg-dark me-2">{method}</span>
                            <code style={{ wordBreak: 'break-all' }}>{buildUrl()}</code>
                            {selectedServer && (
                                <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                                    → {selectedServer.url}/scim/v2/{resourceType}{needsId && idInput ? `/${idInput}` : ''}
                                </div>
                            )}
                        </div>

                        {/* Workflow user picker (shown when preset requires a user) */}
                        {presetActive && (
                            <div className="mb-3 p-2 border border-info rounded">
                                <label className="form-label small fw-bold text-info">
                                    From Workflow — pick a user:
                                </label>
                                {workflowUsersLoading ? (
                                    <div className="text-center py-1"><div className="spinner-border spinner-border-sm" /></div>
                                ) : (
                                    <select className="form-select form-select-sm"
                                        value={selectedWorkflowUserId}
                                        onChange={e => handleWorkflowUserChange(e.target.value)}>
                                        <option value="">— select a user —</option>
                                        {workflowUsers.map(u => (
                                            <option key={u.okta_id} value={u.okta_id}>
                                                {u.first_name} {u.last_name} ({u.email})
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {lookupLoading && (
                                    <div className="text-muted small mt-1">
                                        <span className="spinner-border spinner-border-sm me-1" />
                                        Looking up SCIM ID…
                                    </div>
                                )}
                                {lookupError && <div className="text-warning small mt-1">⚠ {lookupError}</div>}
                                {idInput && !lookupLoading && (
                                    <div className="text-success small mt-1">&#10003; SCIM ID: <code>{idInput}</code></div>
                                )}
                            </div>
                        )}

                        {/* Manual ID input */}
                        {needsId && (
                            <div className="mb-3">
                                <label className="form-label small fw-bold">Resource ID{presetActive ? ' (auto-filled above)' : ''}:</label>
                                <input type="text" className="form-control form-control-sm font-monospace"
                                    placeholder="e.g. a3bf7e5a-1234-..."
                                    value={idInput} onChange={e => setIdInput(e.target.value)} />
                            </div>
                        )}

                        {/* Filter / pagination for list */}
                        {needsFilter && (
                            <div className="mb-3">
                                <label className="form-label small fw-bold">Filter <span className="text-muted fw-normal">(SCIM filter, optional)</span>:</label>
                                <input type="text" className="form-control form-control-sm font-monospace mb-2"
                                    placeholder={`userName eq "john@example.com"`}
                                    value={filterInput} onChange={e => setFilterInput(e.target.value)} />
                                <div className="row g-2">
                                    <div className="col">
                                        <label className="form-label small">startIndex</label>
                                        <input type="number" className="form-control form-control-sm" value={startIndex} onChange={e => setStartIndex(e.target.value)} />
                                    </div>
                                    <div className="col">
                                        <label className="form-label small">count</label>
                                        <input type="number" className="form-control form-control-sm" value={count} onChange={e => setCount(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Payload editor: Create User builds the payload from an identity */}
                        {isUserCreate && (
                            <div className="mb-3">
                                <CredentialCreateForm target="scim" serverId={serverId} identityId={createIdentityId} onIdentityIdChange={setCreateIdentityId}
                                    status={createStatus} onStatusChange={setCreateStatus} payload={payload} onPayloadChange={setPayload} />
                            </div>
                        )}
                        {needsPayload && !isUserCreate && (
                            <div className="mb-3">
                                <label className="form-label small fw-bold">Request Body:</label>
                                <textarea className="form-control font-monospace" rows={10} style={{ fontSize: '0.8rem' }}
                                    value={payload} onChange={e => setPayload(e.target.value)} />
                            </div>
                        )}

                        {/* Set Password inputs (body is built from these, never shown in plaintext) */}
                        {isSetPassword && (
                            <ScimPasswordFields
                                password={newPassword} confirm={confirmPassword} show={showPassword}
                                onPasswordChange={setNewPassword} onConfirmChange={setConfirmPassword} onShowChange={setShowPassword} />
                        )}

                        <button className={`btn btn-${SCIM_ACTION_COLORS[action]}`}
                            onClick={handleExecute}
                            disabled={loading || !serverId}>
                            {loading && <span className="spinner-border spinner-border-sm me-2" />}
                            {loading ? 'Sending…' : `Execute ${SCIM_ACTION_LABELS[action]}`}
                        </button>
                        {!serverId && <span className="text-muted small ms-2">Select a server first</span>}
                    </div>

                    {/* ── Right: response ── */}
                    <div className="col-md-7">
                        <div className="d-flex align-items-center mb-2 gap-2">
                            <span className="fw-bold small">Response</span>
                            {httpStatus && <span className={`badge ${statusBadgeClass}`}>{httpStatus}</span>}
                            {(response !== null || error) && (
                                <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={resetResult}>Clear</button>
                            )}
                        </div>
                        {loading && <div className="text-center py-4"><div className="spinner-border text-primary" /></div>}
                        {!loading && response !== null && (
                            <div>
                                <div className="text-success fw-bold small mb-1">&#10003; Success</div>
                                {canvasNotice === 'done' && (
                                    <div className="small text-success mb-2">
                                        &#10003; Saved to DB and added to the canvas
                                        <button className="btn btn-link btn-sm py-0" onClick={onGoToCanvas}>Go to canvas →</button>
                                    </div>
                                )}
                                {resourceType === 'Users' && <ScimUserResults response={response} serverId={serverId} onShowUser={onShowUser} onGoToCanvas={onGoToCanvas} />}
                                <pre className="json-pre" style={{ maxHeight: '65vh' }}>{fmtJson(response)}</pre>
                            </div>
                        )}
                        {!loading && error && (
                            <div>
                                <div className="text-danger fw-bold small mb-1">&#10007; Error</div>
                                <pre className="json-pre text-danger" style={{ maxHeight: '65vh' }}>{error}</pre>
                            </div>
                        )}
                        {!loading && response === null && !error && (
                            <div className="text-center text-muted py-5">
                                <p className="mb-1">No response yet.</p>
                                <p className="small">Configure a request on the left and click Execute.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
