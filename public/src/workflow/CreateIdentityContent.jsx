// Create Identity: a person in the local database with no credential yet (no Okta user, no AD account).
// Credentials are created for it afterwards (Create Okta credential, SCIM → Create).
const CreateIdentityContent = ({ onClose, onShowUser }) => {
    const [identity, setIdentity] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [created, setCreated] = React.useState(null);

    const handleCreate = async () => {
        setSaving(true); setError(null);
        const { ok, data } = await apiPost('/api/v1/identities', identity);
        setSaving(false);
        if (!ok) { setError(data); return; }
        setCreated(data.user);
        onShowUser(data.user);
    };

    return (
        <>
            <div className="modal-body">
                <div className="mb-2 font-monospace small">
                    <span className="badge bg-dark me-2">POST</span><code>/api/v1/identities</code>
                </div>
                {/* Kept mounted after a create so "Create another" starts from the same template */}
                <div style={{ display: created ? 'none' : '' }}>
                    <IdentityForm onChange={setIdentity} />
                    {error && <div className="mt-2"><ApiError data={error} /></div>}
                </div>
                {created && (
                    <div>
                        <div className="text-success fw-bold mb-2">&#10003; Identity created — it is on the canvas</div>
                        <pre className="json-pre">{fmtJson(created.identity)}</pre>
                    </div>
                )}
            </div>
            <div className="modal-footer">
                {!created && (
                    <button className="btn btn-success" disabled={!identity || saving} onClick={handleCreate}>
                        {saving && <span className="spinner-border spinner-border-sm me-1" />}Create Identity
                    </button>
                )}
                {created && <button className="btn btn-outline-primary" onClick={() => setCreated(null)}>Create another</button>}
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};

// Edit Identity: replace a stored identity's attributes. Its Okta / SCIM copies are not changed, so they
// show as stale (and differ in User Details) until those systems are updated.
const EditIdentityContent = ({ onClose, onUserChanged, user }) => {
    const [identity, setIdentity] = React.useState(user.identity || null);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [saved, setSaved] = React.useState(false);

    const handleSave = async () => {
        setSaving(true); setError(null);
        const { ok, data } = await api(`/api/v1/identities/${user.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity),
        });
        setSaving(false);
        if (!ok) { setError(data); return; }
        setSaved(true);
        onUserChanged(data.user.id, data.user);
    };

    return (
        <>
            <div className="modal-body">
                <p className="small text-muted">
                    Changes the local identity only.
                    {(user.okta_id || user.scim_accounts?.length > 0) && ' Its Okta / SCIM users keep their values and show as stale until they are updated.'}
                </p>
                <IdentityForm initial={user.identity} onChange={(v) => { setIdentity(v); setSaved(false); }} />
                {error && <div className="mt-2"><ApiError data={error} /></div>}
                {saved && <div className="text-success fw-bold small mt-2">&#10003; Identity saved</div>}
            </div>
            <div className="modal-footer">
                <button className="btn btn-primary" disabled={!identity || saving} onClick={handleSave}>
                    {saving && <span className="spinner-border spinner-border-sm me-1" />}Save Identity
                </button>
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};
