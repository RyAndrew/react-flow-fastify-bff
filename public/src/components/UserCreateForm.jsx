// Shared create-user form for every create screen (Okta Create User, SCIM client Create, SCIM Operations).
// Builds the payload from a stored template + a person (random name, a prefill option, or a fixed `person`)
// + the initial status. The parent owns payload and status; it sends the request itself.
//   target          'okta' | 'scim'
//   person          fixed person (no Random Name / prefill), e.g. the local user being pushed to SCIM
//   prefillOptions  [{ value, label, disabled?, person }] — memoize; prefillValue / onPrefillChange control it
const UserCreateForm = ({ target, payload, onPayloadChange, status, onStatusChange,
                          person: fixedPerson, prefillOptions, prefillLabel, prefillValue = '', onPrefillChange, rows = 12 }) => {
    const storageKey = `userTemplate.${target}`;
    const [templates, setTemplates] = React.useState(null);
    const [templateId, setTemplateId] = React.useState(() => { try { return localStorage.getItem(storageKey) || ''; } catch { return ''; } });
    const [person, setPerson] = React.useState(fixedPerson || null);
    const [nameLoading, setNameLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [showHelp, setShowHelp] = React.useState(false);
    const [showManager, setShowManager] = React.useState(false);

    const loadTemplates = (selectId) => api(`/api/v1/templates?target=${target}`).then(({ ok, data }) => {
        if (!ok) { setError(`Loading templates failed: ${data?.error || 'unknown error'}`); return; }
        const list = data.templates || [];
        setTemplates(list);
        // Keep the remembered/selected template if it still exists, else the first one
        setTemplateId(cur => {
            const want = String(selectId || cur);
            return list.some(t => String(t.id) === want) ? want : String(list[0]?.id || '');
        });
    });
    React.useEffect(() => { loadTemplates(); }, []);

    const randomName = async () => {
        setNameLoading(true);
        const { ok, data } = await api('/api/v1/names/random');
        setNameLoading(false);
        if (!ok) { setError(`Random name failed: ${data?.error || 'unknown error'}`); return; }
        setPerson({ firstName: data.firstName, middleName: data.middleName, lastName: data.lastName, gender: data.gender });
    };

    // Prefill picked → use that user; prefill cleared (or nothing yet) → random person
    const prevPrefill = React.useRef(prefillValue);
    React.useEffect(() => {
        if (fixedPerson) return;
        if (prefillValue) {
            const opt = prefillOptions?.find(o => String(o.value) === String(prefillValue));
            if (opt) setPerson(opt.person);
        } else if (prevPrefill.current || !person) randomName();
        prevPrefill.current = prefillValue;
    }, [prefillValue, prefillOptions]);

    const template = templates?.find(t => String(t.id) === String(templateId));

    // Rebuild the payload whenever the template or person changes (discards manual edits)
    React.useEffect(() => {
        if (!template || !person) return;
        try { onPayloadChange(buildUserPayload(template, person, target, status)); setError(null); }
        catch (e) { setError(e.message); }
    }, [template, person]);

    const selectTemplate = (id) => {
        setTemplateId(id);
        try { localStorage.setItem(storageKey, id); } catch { }
    };

    // Status only patches the current payload so edits survive; leave it alone if the JSON is mid-edit and invalid
    const selectStatus = (value) => {
        onStatusChange(value);
        try { onPayloadChange(JSON.stringify(applyUserStatus(target, JSON.parse(payload), value), null, 2)); } catch { }
    };

    const handleRandomName = () => (prefillValue ? onPrefillChange('') : randomName());

    return (
        <div>
            <label className="form-label small fw-bold">Template:</label>
            <div className="input-group input-group-sm mb-3">
                <select className="form-select form-select-sm" value={templateId} onChange={e => selectTemplate(e.target.value)}
                    disabled={!templates?.length}>
                    {!templates && <option value="">Loading templates…</option>}
                    {templates && !templates.length && <option value="">No {USER_TEMPLATE_TARGETS[target]} templates — add one with Manage</option>}
                    {templates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className="btn btn-outline-secondary" onClick={() => setShowManager(true)}>Manage</button>
                <button className="btn btn-outline-info" title="Tokens and features" onClick={() => setShowHelp(true)}>?</button>
            </div>

            {prefillOptions && (
                <>
                    <label className="form-label small fw-bold">{prefillLabel || 'Prefill from'} (optional):</label>
                    <select className="form-select form-select-sm mb-3" value={prefillValue} onChange={e => onPrefillChange(e.target.value)}
                        disabled={!prefillOptions.length}>
                        <option value="">{prefillOptions.length ? '— none (random name) —' : 'No users available to prefill from'}</option>
                        {prefillOptions.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
                    </select>
                </>
            )}

            <label className="form-label small fw-bold">Initial status:</label>
            <select className="form-select form-select-sm mb-3" value={status} onChange={e => selectStatus(e.target.value)}>
                {USER_CREATE_STATUSES[target].map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <div className="d-flex justify-content-between align-items-end mb-1">
                <label className="form-label small fw-bold mb-0">
                    Payload (edit before sending):
                    {fixedPerson && <span className="text-muted fw-normal"> — from {fixedPerson.firstName} {fixedPerson.lastName}</span>}
                </label>
                {fixedPerson ? (
                    <button className="btn btn-sm btn-outline-secondary" disabled={!template} onClick={() => setPerson({ ...fixedPerson })}>↻ Regenerate</button>
                ) : (
                    <button className="btn btn-sm btn-outline-secondary" disabled={nameLoading} onClick={handleRandomName}>
                        {nameLoading && <span className="spinner-border spinner-border-sm me-1" />}Random Name
                    </button>
                )}
            </div>
            {error && <div className="text-danger small mb-1">⚠ {error}</div>}
            <textarea className="form-control font-monospace" rows={rows} style={{ fontSize: '0.8rem' }}
                value={payload} onChange={e => onPayloadChange(e.target.value)} />

            {showManager && (
                <TemplateManager target={target} onClose={() => setShowManager(false)} onShowHelp={() => setShowHelp(true)}
                    onChanged={(saved) => loadTemplates(saved?.target === target ? saved.id : undefined)} />
            )}
            {showHelp && <TemplateTokenHelp onClose={() => setShowHelp(false)} />}
        </div>
    );
};
