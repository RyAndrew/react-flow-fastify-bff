// New/confirm password inputs with show/hide and generate, plus a masked preview of the
// PatchOp body (the body is built from these, never shown in plaintext). Controlled by the parent.
const ScimPasswordFields = ({ password, confirm, show, onPasswordChange, onConfirmChange, onShowChange }) => {
    const handleGenerate = () => {
        const pw = generatePassword();
        onPasswordChange(pw); onConfirmChange(pw); onShowChange(true);
    };

    return (
        <div className="mb-3">
            <label className="form-label small fw-bold">New Password:</label>
            <div className="input-group input-group-sm mb-2">
                <input type={show ? 'text' : 'password'} className="form-control font-monospace"
                    autoComplete="new-password"
                    value={password} onChange={e => onPasswordChange(e.target.value)} />
                <button className="btn btn-outline-secondary" type="button" onClick={() => onShowChange(!show)}>
                    {show ? 'Hide' : 'Show'}
                </button>
                <button className="btn btn-outline-secondary" type="button" onClick={handleGenerate}>
                    Generate
                </button>
            </div>
            <label className="form-label small fw-bold">Confirm Password:</label>
            <input type={show ? 'text' : 'password'} className="form-control form-control-sm font-monospace mb-1"
                autoComplete="new-password"
                value={confirm} onChange={e => onConfirmChange(e.target.value)} />
            {confirm && password !== confirm && (
                <div className="text-warning small mb-1">⚠ Passwords do not match</div>
            )}
            <label className="form-label small fw-bold mt-2">Request Body <span className="text-muted fw-normal">(preview, password masked)</span>:</label>
            <pre className="json-pre mb-0" style={{ fontSize: '0.8rem' }}>
                {fmtJson(buildScimPasswordPatch(password ? '••••••••' : ''))}
            </pre>
        </div>
    );
};
