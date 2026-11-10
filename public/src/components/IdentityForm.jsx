// Builds an identity (flat attribute → value, canonical names) from a stored template and a random person,
// shown as editable JSON. Used by Create Identity, Edit Identity and the inline "new identity" of every
// credential create. The parent owns the identity: onChange gets the parsed object, or null while the
// JSON is invalid.
//   initial   start from this identity (Edit Identity) instead of rendering a template
const IdentityForm = ({ onChange, initial, rows = 12 }) => {
    const storageKey = 'identityTemplate';
    const [templates, setTemplates] = React.useState(null);
    const [templateId, setTemplateId] = React.useState(() => { try { return localStorage.getItem(storageKey) || ''; } catch { return ''; } });
    const [attributes, setAttributes] = React.useState(null);
    const [person, setPerson] = React.useState(null);
    const [nameLoading, setNameLoading] = React.useState(false);
    const [text, setText] = React.useState(initial ? JSON.stringify(initial, null, 2) : '');
    const [error, setError] = React.useState(null);
    const [showHelp, setShowHelp] = React.useState(false);
    const [showManager, setShowManager] = React.useState(false);

    const loadTemplates = (selectId) => api('/api/v1/templates').then(({ ok, data }) => {
        if (!ok) { setError(`Loading templates failed: ${data?.error || 'unknown error'}`); return; }
        const list = data.templates || [];
        setTemplates(list);
        // Keep the remembered/selected template if it still exists, else the first one
        setTemplateId(cur => {
            const want = String(selectId || cur);
            return list.some(t => String(t.id) === want) ? want : String(list[0]?.id || '');
        });
    });
    React.useEffect(() => {
        loadTemplates();
        loadIdentityAttributes().then(setAttributes);
        if (initial) onChange(initial); else randomName();
    }, []);

    const randomName = async () => {
        setNameLoading(true);
        const { ok, data } = await api('/api/v1/names/random');
        setNameLoading(false);
        if (!ok) { setError(`Random name failed: ${data?.error || 'unknown error'}`); return; }
        setPerson({ firstName: data.firstName, middleName: data.middleName, lastName: data.lastName, gender: data.gender });
    };

    const template = templates?.find(t => String(t.id) === String(templateId));

    // Rebuild whenever the template or person changes (discards manual edits). Waits for the attribute
    // list so unknown keys are caught.
    React.useEffect(() => {
        if (!template || !person || !attributes) return;
        try {
            const identity = buildIdentity(template, person, attributes);
            setText(JSON.stringify(identity, null, 2)); setError(null); onChange(identity);
        } catch (e) { setError(e.message); }
    }, [template, person, attributes]);

    const editText = (value) => {
        setText(value);
        let parsed;
        try { parsed = JSON.parse(value); } catch { setError('Invalid JSON'); onChange(null); return; }
        try { onChange(parseIdentity(parsed, attributes)); setError(null); }
        catch (e) { setError(e.message); onChange(null); }
    };

    const selectTemplate = (id) => {
        setTemplateId(id);
        try { localStorage.setItem(storageKey, id); } catch { }
        // In edit mode nothing is rendered until a person is picked: picking a template starts one
        if (!person) randomName();
    };

    return (
        <div>
            <label className="form-label small fw-bold">Identity template:</label>
            <div className="input-group input-group-sm mb-3">
                <select className="form-select form-select-sm" value={templateId} onChange={e => selectTemplate(e.target.value)}
                    disabled={!templates?.length}>
                    {!templates && <option value="">Loading templates…</option>}
                    {templates && !templates.length && <option value="">No templates — add one with Manage</option>}
                    {templates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className="btn btn-outline-secondary" onClick={() => setShowManager(true)}>Manage</button>
                <button className="btn btn-outline-info" title="Tokens and attributes" onClick={() => setShowHelp(true)}>?</button>
            </div>

            <div className="d-flex justify-content-between align-items-end mb-1">
                <label className="form-label small fw-bold mb-0">
                    Identity attributes (edit before saving):
                    {initial && !person && <span className="text-muted fw-normal"> — current values</span>}
                </label>
                <button className="btn btn-sm btn-outline-secondary" disabled={nameLoading} onClick={randomName}>
                    {nameLoading && <span className="spinner-border spinner-border-sm me-1" />}{initial ? 'Regenerate from template' : 'Random Name'}
                </button>
            </div>
            {error && <div className="text-danger small mb-1">⚠ {error}</div>}
            <textarea className="form-control font-monospace" rows={rows} style={{ fontSize: '0.8rem' }}
                value={text} onChange={e => editText(e.target.value)} />

            {showManager && (
                <TemplateManager onClose={() => setShowManager(false)} onShowHelp={() => setShowHelp(true)}
                    onChanged={(saved) => loadTemplates(saved?.id)} />
            )}
            {showHelp && <TemplateTokenHelp onClose={() => setShowHelp(false)} />}
        </div>
    );
};
