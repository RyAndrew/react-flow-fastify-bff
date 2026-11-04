// Add / edit / duplicate / delete create-user templates (/api/v1/templates). Opens on top of other modals.
const PREVIEW_PERSON = { firstName: 'Jane', middleName: 'Q', lastName: 'Doe', gender: 'female' };

const TemplateManager = ({ target, onClose, onChanged, onShowHelp }) => {
    const emptyForm = { name: '', target, body: '' };
    const [templates, setTemplates] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [editingId, setEditingId] = React.useState(null);
    const [form, setForm] = React.useState(emptyForm);
    const [saving, setSaving] = React.useState(false);
    const [deleting, setDeleting] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [preview, setPreview] = React.useState(null); // { ok, text }

    const loadTemplates = () => {
        setLoading(true);
        api(`/api/v1/templates?target=${target}`).then(({ data }) => {
            setTemplates(data.templates || []);
            setLoading(false);
        });
    };
    React.useEffect(loadTemplates, []);

    const startForm = (f, id = null) => { setEditingId(id); setForm(f); setError(null); setPreview(null); };
    const handleEdit = (t) => startForm({ name: t.name, target: t.target, body: t.body }, t.id);
    const handleDuplicate = (t) => startForm({ name: `${t.name} (copy)`, target: t.target, body: t.body });
    const handleCancel = () => startForm(emptyForm);

    const handlePreview = () => {
        try { setPreview({ ok: true, text: buildUserPayload(form, PREVIEW_PERSON, form.target, DEFAULT_CREATE_STATUS[form.target]) }); }
        catch (e) { setPreview({ ok: false, text: e.message }); }
    };

    const handleSave = async () => {
        setSaving(true); setError(null);
        const { ok, data } = await api(editingId ? `/api/v1/templates/${editingId}` : '/api/v1/templates', {
            method: editingId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        setSaving(false);
        if (!ok) { setError(data || 'Save failed'); return; }
        handleCancel();
        loadTemplates();
        onChanged(data.template);
    };

    const handleDelete = async (id) => {
        setDeleting(id);
        await api(`/api/v1/templates/${id}`, { method: 'DELETE' });
        setDeleting(null);
        if (editingId === id) handleCancel();
        loadTemplates();
        onChanged();
    };

    const setField = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

    return ReactDOM.createPortal(
        <Modal show={true} onClose={onClose} title={`${USER_TEMPLATE_TARGETS[target]} User Templates`} size="modal-xl">
            <div className="modal-body">
                {loading ? (
                    <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>
                ) : templates.length === 0 ? (
                    <p className="text-muted small">No templates yet. Add one below.</p>
                ) : (
                    <table className="table table-sm table-bordered mb-4">
                        <thead className="table-light">
                            <tr><th>Name</th><th>Updated</th><th style={{ width: '220px' }}></th></tr>
                        </thead>
                        <tbody>
                            {templates.map(t => (
                                <tr key={t.id} className={editingId === t.id ? 'table-active' : ''}>
                                    <td>{t.name}</td>
                                    <td className="small text-nowrap">{t.updated_at ? new Date(t.updated_at).toLocaleString() : '—'}</td>
                                    <td>
                                        <button className="btn btn-outline-primary btn-sm me-1" onClick={() => handleEdit(t)}>Edit</button>
                                        <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => handleDuplicate(t)}>Duplicate</button>
                                        <button className="btn btn-outline-danger btn-sm" disabled={deleting === t.id} onClick={() => handleDelete(t.id)}>
                                            {deleting === t.id ? <span className="spinner-border spinner-border-sm" /> : 'Delete'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                <div className="d-flex justify-content-between align-items-center border-top pt-3 mb-2">
                    <h6 className="fw-bold mb-0">{editingId ? 'Edit Template' : 'Add Template'}</h6>
                    <button className="btn btn-outline-info btn-sm" onClick={onShowHelp}>? Tokens</button>
                </div>
                {error && <div className="mb-2"><ApiError data={error} /></div>}
                <div className="row g-2">
                    <div className="col-md-8">
                        <label className="form-label small">Name</label>
                        <input className="form-control form-control-sm" placeholder="e.g. AD contractor"
                            value={form.name} onChange={setField('name')} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label small">API</label>
                        <select className="form-select form-select-sm" value={form.target} onChange={setField('target')}>
                            {Object.entries(USER_TEMPLATE_TARGETS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </div>
                    <div className="col-md-6">
                        <label className="form-label small">Body (JSON with tokens)</label>
                        <textarea className="form-control font-monospace" rows={16} style={{ fontSize: '0.8rem' }}
                            value={form.body} onChange={setField('body')} />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label small">Preview <span className="text-muted">(Jane Q Doe, default status)</span></label>
                        {preview
                            ? <pre className={`json-pre ${preview.ok ? '' : 'text-danger'}`} style={{ maxHeight: '340px' }}>{preview.text}</pre>
                            : <div className="text-muted small border rounded p-2">Click Preview to render the body.</div>}
                    </div>
                </div>
                <div className="mt-3 d-flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                        {saving && <span className="spinner-border spinner-border-sm me-1" />}
                        {editingId ? 'Save Changes' : 'Add Template'}
                    </button>
                    <button className="btn btn-outline-info btn-sm" onClick={handlePreview}>Preview</button>
                    {(editingId || form.body) && <button className="btn btn-outline-secondary btn-sm" onClick={handleCancel}>Cancel</button>}
                </div>
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </Modal>,
        document.body
    );
};
