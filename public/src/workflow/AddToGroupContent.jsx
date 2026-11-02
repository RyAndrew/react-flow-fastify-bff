// Autocomplete group search, then add the user to the chosen group
const AddToGroupContent = ({ userId }) => {
    const [query, setQuery] = React.useState('');
    const [suggestions, setSuggestions] = React.useState([]);
    const [searching, setSearching] = React.useState(false);
    const [selectedGroup, setSelectedGroup] = React.useState(null);
    const [showDropdown, setShowDropdown] = React.useState(false);
    const [status, setStatus] = React.useState('idle');
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);
    const debounceRef = React.useRef(null);
    const wrapperRef = React.useRef(null);

    React.useEffect(() => {
        setQuery('');
        setSuggestions([]);
        setSelectedGroup(null);
        setStatus('idle');
        setResult(null);
        setError(null);
    }, [userId]);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClick = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleInputChange = (val) => {
        setQuery(val);
        setSelectedGroup(null);
        setStatus('idle');
        setResult(null);
        setError(null);
        clearTimeout(debounceRef.current);
        if (val.trim().length < 1) { setSuggestions([]); setShowDropdown(false); return; }
        setSearching(true);
        setShowDropdown(true);
        debounceRef.current = setTimeout(() => {
            api(`/api/v1/users/groups/search?q=${encodeURIComponent(val.trim())}`).then(({ ok, data }) => {
                if (ok) setSuggestions(data.groups || []);
                else setSuggestions([]);
                setSearching(false);
            });
        }, 300);
    };

    const handleSelect = (group) => {
        setSelectedGroup(group);
        setQuery(group.profile?.name || group.id);
        setShowDropdown(false);
        setStatus('idle');
        setResult(null);
        setError(null);
    };

    const handleAddToGroup = async () => {
        if (!selectedGroup) return;
        setStatus('running'); setError(null);
        const { ok, data } = await api(`/api/v1/users/${userId}/groups/${selectedGroup.id}`, { method: 'PUT' });
        if (ok) { setStatus('done'); setResult({ groupId: selectedGroup.id, groupName: selectedGroup.profile?.name }); }
        else { setStatus('error'); setError(data.details?.errorSummary || data.error || 'Failed to add user to group'); }
    };

    const reset = () => {
        setStatus('idle'); setResult(null); setError(null);
        setSelectedGroup(null); setQuery(''); setSuggestions([]);
    };

    return (
        <div style={{ 'min-height': '160px' }}>
            <div className="mb-2 font-monospace small">
                <span className="badge bg-dark me-2">PUT</span>
                <code>{selectedGroup
                    ? `/api/v1/groups/${selectedGroup.id}/users/${userId}`
                    : `/api/v1/groups/{groupId}/users/${userId}`}</code>
            </div>
            {status !== 'done' && (
                <div ref={wrapperRef} style={{ position: 'relative' }}>
                    <label className="form-label small fw-bold">Search for a group by name:</label>
                    <input
                        type="text" className="form-control mb-1" placeholder="Type a group name..."
                        value={query} onChange={e => handleInputChange(e.target.value)}
                        onFocus={() => { if (suggestions.length) setShowDropdown(true); }}
                    />
                    {showDropdown && (
                        <div className="list-group" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                            {searching && (
                                <div className="list-group-item text-center text-muted small py-2">
                                    <span className="spinner-border spinner-border-sm me-1" /> Searching...
                                </div>
                            )}
                            {!searching && suggestions.length === 0 && query.trim().length > 0 && (
                                <div className="list-group-item text-muted small">No groups found</div>
                            )}
                            {!searching && suggestions.map(g => (
                                <button key={g.id} type="button"
                                    className={`list-group-item list-group-item-action small${selectedGroup?.id === g.id ? ' active' : ''}`}
                                    onClick={() => handleSelect(g)}>
                                    <div className="fw-bold">{g.profile?.name || g.id}</div>
                                    {g.profile?.description && <div className="text-muted small">{g.profile.description}</div>}
                                    <div className="text-muted small">Type: {g.type} &middot; ID: {g.id}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {selectedGroup && status === 'idle' && (
                <div className="mt-2">
                    <label className="form-label small fw-bold">Payload preview:</label>
                    <pre className="json-pre">{fmtJson({
                        method: 'PUT',
                        url: `/api/v1/groups/${selectedGroup.id}/users/${userId}`,
                        group: { id: selectedGroup.id, name: selectedGroup.profile?.name, type: selectedGroup.type },
                    })}</pre>
                    {error && <p className="text-danger small mb-1">{error}</p>}
                    <button className="btn btn-primary btn-sm" onClick={handleAddToGroup}>Add to Group</button>
                </div>
            )}
            {status === 'running' && <div className="text-center py-2"><div className="spinner-border spinner-border-sm text-primary" /></div>}
            {status === 'done' && (
                <div>
                    <div className="text-success fw-bold small mb-1">&#10003; User added to group "{result.groupName}"</div>
                    <pre className="json-pre">{fmtJson(result)}</pre>
                    <button className="btn btn-outline-secondary btn-sm mt-1" onClick={reset}>Add to Another Group</button>
                </div>
            )}
            {status === 'error' && (
                <div>
                    <p className="text-danger small mb-1">&#10007; {error}</p>
                    <button className="btn btn-outline-secondary btn-sm" onClick={reset}>Try Again</button>
                </div>
            )}
        </div>
    );
};
