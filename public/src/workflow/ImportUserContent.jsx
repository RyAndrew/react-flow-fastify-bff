// The four ways the Okta Users API can find users
const OKTA_SEARCH_MODES = [
    { mode: 'q',      label: 'Quick (q)',   placeholder: 'jane',
      help: 'Prefix match on first name, last name or email. Fast, but not meant for large orgs.' },
    { mode: 'filter', label: 'Filter',      placeholder: 'status eq "ACTIVE"',
      help: 'eq / gt / lt on status, lastUpdated, id, profile.login, profile.email, profile.firstName, profile.lastName.' },
    { mode: 'search', label: 'Search',      placeholder: 'profile.department eq "Engineering" and status eq "ACTIVE"',
      help: 'Any profile attribute (including custom) with eq, sw, co, pr, gt, lt, and/or. Okta\'s recommended option.' },
    { mode: 'lookup', label: 'ID / Login',  placeholder: '00u1abcd2EFGH3ijk4x7 or jane@example.com',
      help: 'Fetch a single user by Okta ID or login.' },
];

const ImportUserContent = ({ onClose, onScimNavigate }) => {
    const [mode, setMode] = React.useState('q');
    const [value, setValue] = React.useState('');
    const [limit, setLimit] = React.useState('20');
    const [results, setResults] = React.useState(null);
    const [nextAfter, setNextAfter] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [localIds, setLocalIds] = React.useState(new Set());
    const [importing, setImporting] = React.useState({}); // oktaId → 'running' | 'done' | error response

    React.useEffect(() => {
        api('/api/v1/users?scope=all').then(({ data }) => {
            setLocalIds(new Set((data.users || []).map(u => u.okta_id).filter(Boolean)));
        });
    }, []);

    const modeCfg = OKTA_SEARCH_MODES.find(m => m.mode === mode);

    const downstreamPreview = mode === 'lookup'
        ? `/api/v1/users/${value || '{id|login}'}`
        : `/api/v1/users?${new URLSearchParams({ limit, ...(value ? { [mode]: value } : {}) })}`;

    const runSearch = async (after) => {
        if (mode === 'lookup' && !value.trim()) { setError('Enter an Okta ID or login'); return; }
        setLoading(true); setError(null);
        const qs = new URLSearchParams({ mode, value: value.trim(), limit });
        if (after) qs.set('after', after);
        const { ok, data } = await api(`/api/v1/users/okta/search?${qs}`);
        setLoading(false);
        if (ok) {
            setResults(prev => after ? [...(prev || []), ...data.users] : data.users);
            setNextAfter(data.nextAfter);
        } else {
            setError(data);
        }
    };

    const changeMode = (m) => { setMode(m); setValue(''); setResults(null); setNextAfter(null); setError(null); };

    const handleImport = async (oktaId) => {
        setImporting(s => ({ ...s, [oktaId]: 'running' }));
        const { ok, data } = await apiPost(`/api/v1/users/${encodeURIComponent(oktaId)}/import`, {});
        if (ok) {
            setImporting(s => ({ ...s, [oktaId]: 'done' }));
            setLocalIds(ids => new Set(ids).add(oktaId));
        } else {
            setImporting(s => ({ ...s, [oktaId]: data }));
        }
    };

    const openScim = () => { onClose(); onScimNavigate('import'); };

    return (
        <>
            <div className="modal-body">
                <div className="d-flex align-items-center gap-2 mb-3">
                    <ul className="nav nav-pills">
                        {OKTA_SEARCH_MODES.map(m => (
                            <li className="nav-item" key={m.mode}>
                                <button className={`nav-link py-1 ${mode === m.mode ? 'active' : ''}`} onClick={() => changeMode(m.mode)}>{m.label}</button>
                            </li>
                        ))}
                    </ul>
                    <button className="btn btn-outline-info btn-sm ms-auto text-nowrap" onClick={openScim}>↗ Import from SCIM</button>
                </div>

                <form className="d-flex gap-2 mb-1" onSubmit={e => { e.preventDefault(); runSearch(); }}>
                    <input type="text" className="form-control form-control-sm font-monospace"
                        placeholder={modeCfg.placeholder} value={value} onChange={e => setValue(e.target.value)} />
                    {mode !== 'lookup' && (
                        <select className="form-select form-select-sm" style={{ width: '90px' }} value={limit} onChange={e => setLimit(e.target.value)}>
                            {['10', '20', '50', '200'].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    )}
                    <button type="submit" className="btn btn-primary btn-sm text-nowrap" disabled={loading}>
                        {loading && <span className="spinner-border spinner-border-sm me-1" />}
                        Search
                    </button>
                </form>
                <div className="form-text mb-2">{modeCfg.help}</div>
                <div className="mb-3 font-monospace small text-muted">
                    <span className="badge bg-dark me-2">GET</span>
                    <code style={{ wordBreak: 'break-all' }}>{downstreamPreview}</code>
                </div>

                {error && <div className="mb-2"><ApiError data={error} /></div>}

                {results && !results.length && <p className="text-muted small">No users found.</p>}
                {results && results.length > 0 && (
                    <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
                        <table className="table table-sm table-hover mb-2">
                            <thead className="table-light">
                                <tr><th>Name</th><th>Email</th><th>Login</th><th>Status</th><th>Okta ID</th><th style={{ width: '130px' }}></th></tr>
                            </thead>
                            <tbody>
                                {results.map(u => {
                                    const state = importing[u.id];
                                    const inDb = localIds.has(u.id);
                                    return (
                                        <tr key={u.id}>
                                            <td>{u.profile?.firstName} {u.profile?.lastName}</td>
                                            <td>{u.profile?.email}</td>
                                            <td>{u.profile?.login}</td>
                                            <td><StatusBadge status={u.status} /></td>
                                            <td><code className="small">{u.id}</code></td>
                                            <td className="text-end">
                                                {inDb && state !== 'running' && <span className="badge bg-success me-1">In DB</span>}
                                                <button className={`btn btn-sm ${inDb ? 'btn-outline-secondary' : 'btn-success'}`}
                                                    disabled={state === 'running'} onClick={() => handleImport(u.id)}>
                                                    {state === 'running' ? <span className="spinner-border spinner-border-sm" /> : inDb ? 'Re-sync' : 'Import'}
                                                </button>
                                                {typeof state === 'object' && <ApiError data={state} compact />}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {nextAfter && (
                    <button className="btn btn-outline-primary btn-sm" disabled={loading} onClick={() => runSearch(nextAfter)}>Load more</button>
                )}
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </>
    );
};
