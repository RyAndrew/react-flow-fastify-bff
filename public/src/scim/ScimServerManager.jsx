const ScimServerManager = ({ onClose, onChanged }) => {
    const [servers, setServers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [editingId, setEditingId] = React.useState(null);
    const [form, setForm] = React.useState({ name: '', url: '', username: '', password: '' });
    const [saving, setSaving] = React.useState(false);
    const [deleting, setDeleting] = React.useState(null);
    const [error, setError] = React.useState(null);

    const loadServers = () => {
        setLoading(true);
        api('/api/v1/scim-servers').then(({ data }) => {
            setServers(data.servers || []);
            setLoading(false);
        });
    };
    React.useEffect(loadServers, []);

    const handleEdit = (s) => {
        setEditingId(s.id);
        setForm({ name: s.name, url: s.url, username: s.username, password: '' });
        setError(null);
    };

    const handleCancel = () => {
        setEditingId(null);
        setForm({ name: '', url: '', username: '', password: '' });
        setError(null);
    };

    const handleSave = async () => {
        setSaving(true); setError(null);
        const method = editingId ? 'PUT' : 'POST';
        const url = editingId ? `/api/v1/scim-servers/${editingId}` : '/api/v1/scim-servers';
        const { ok, data } = await api(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        setSaving(false);
        if (ok) {
            handleCancel();
            loadServers();
            onChanged();
        } else {
            setError(data || 'Save failed');
        }
    };

    const handleDelete = async (id) => {
        setDeleting(id);
        await api(`/api/v1/scim-servers/${id}`, { method: 'DELETE' });
        setDeleting(null);
        loadServers();
        onChanged();
    };

    const setField = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

    return (
        <Modal show={true} onClose={onClose} title="SCIM Servers" size="modal-lg">
            <div className="modal-body">
                {loading ? (
                    <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>
                ) : servers.length === 0 ? (
                    <p className="text-muted small">No servers configured yet. Add one below.</p>
                ) : (
                    <table className="table table-sm table-bordered mb-4">
                        <thead className="table-light">
                            <tr><th>Name</th><th>URL</th><th>Username</th><th style={{ width: '130px' }}></th></tr>
                        </thead>
                        <tbody>
                            {servers.map(s => (
                                <tr key={s.id}>
                                    <td>{s.name}</td>
                                    <td><code className="small">{s.url}</code></td>
                                    <td>{s.username}</td>
                                    <td>
                                        <button className="btn btn-outline-primary btn-sm me-1" onClick={() => handleEdit(s)}>Edit</button>
                                        <button className="btn btn-outline-danger btn-sm"
                                            disabled={deleting === s.id}
                                            onClick={() => handleDelete(s.id)}>
                                            {deleting === s.id ? <span className="spinner-border spinner-border-sm" /> : 'Delete'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                <h6 className="fw-bold border-top pt-3">{editingId ? 'Edit Server' : 'Add Server'}</h6>
                {error && <div className="mb-2"><ApiError data={error} /></div>}
                <div className="row g-2">
                    <div className="col-md-6">
                        <label className="form-label small">Name</label>
                        <input className="form-control form-control-sm" placeholder="e.g. Production"
                            value={form.name} onChange={setField('name')} />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label small">URL</label>
                        <input className="form-control form-control-sm font-monospace" placeholder="http://localhost:8080"
                            value={form.url} onChange={setField('url')} />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label small">Username</label>
                        <input className="form-control form-control-sm" placeholder="Username"
                            value={form.username} onChange={setField('username')} />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label small">Password</label>
                        <input type="password" className="form-control form-control-sm"
                            placeholder={editingId ? 'Leave blank to keep current' : 'Password'}
                            value={form.password} onChange={setField('password')} />
                    </div>
                </div>
                <div className="mt-3 d-flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                        {saving && <span className="spinner-border spinner-border-sm me-1" />}
                        {editingId ? 'Save Changes' : 'Add Server'}
                    </button>
                    {editingId && <button className="btn btn-outline-secondary btn-sm" onClick={handleCancel}>Cancel</button>}
                </div>
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </Modal>
    );
};
