// Query form for one log source. `filters` is that source's filter object (see LOG_DEFAULT_FILTERS);
// edits go through onChange and only take effect when the form is submitted (onApply).
const LogFilters = ({ source, filters, onChange, onApply, onReset, loading }) => {
    const set = (key) => (e) => onChange({ ...filters, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
    const isOkta = source === 'okta';

    return (
        <form className="row g-2 align-items-end mb-2" onSubmit={e => { e.preventDefault(); onApply(); }}>
            {isOkta ? (
                <div className="col-lg-5">
                    <label className="form-label small mb-0">Filter <span className="text-muted">(Okta expression)</span></label>
                    <input className="form-control form-control-sm font-monospace" value={filters.filter} onChange={set('filter')}
                        placeholder='eventType sw "user.lifecycle" and outcome.result eq "SUCCESS"' />
                </div>
            ) : (
                <>
                    <div className="col-lg-3">
                        <label className="form-label small mb-0">URL contains <span className="text-muted">(comma = any)</span></label>
                        <input className="form-control form-control-sm font-monospace" value={filters.url} onChange={set('url')}
                            placeholder={source === 'scim' ? '/Users,/Groups' : '/api/v1/users'} />
                    </div>
                    <div className="col-auto">
                        <label className="form-label small mb-0">Method</label>
                        <select className="form-select form-select-sm" value={filters.method} onChange={set('method')}>
                            <option value="">Any</option>
                            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="col-auto">
                        <label className="form-label small mb-0">Status</label>
                        <select className="form-select form-select-sm" value={filters.status} onChange={set('status')}>
                            <option value="">Any</option>
                            <option value="2xx">2xx</option>
                            <option value="3xx">3xx</option>
                            <option value="4xx">4xx</option>
                            <option value="5xx">5xx</option>
                            <option value="error">Errors (4xx/5xx)</option>
                        </select>
                    </div>
                </>
            )}
            <div className="col-lg">
                <label className="form-label small mb-0">{isOkta ? 'Keywords' : 'Text'} <span className="text-muted">{isOkta ? '(space separated)' : '(URL, bodies, error)'}</span></label>
                <input className="form-control form-control-sm" value={filters.q} onChange={set('q')} placeholder="jane@example.com" />
            </div>
            <div className="col-auto">
                <label className="form-label small mb-0">Time</label>
                <select className="form-select form-select-sm" value={filters.since} onChange={set('since')}>
                    {LOG_TIME_WINDOWS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
            </div>
            <div className="col-auto">
                <label className="form-label small mb-0">Limit</label>
                <select className="form-select form-select-sm" value={filters.limit} onChange={set('limit')}>
                    {['25', '50', '100', '200'].map(n => <option key={n}>{n}</option>)}
                </select>
            </div>
            {!isOkta && (
                <div className="col-auto">
                    <div className="form-check mb-1">
                        <input className="form-check-input" type="checkbox" id="hide-log-queries" checked={filters.hideLogQueries} onChange={set('hideLogQueries')} />
                        <label className="form-check-label small" htmlFor="hide-log-queries">Hide log queries</label>
                    </div>
                </div>
            )}
            <div className="col-auto d-flex gap-1">
                <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                    {loading ? <span className="spinner-border spinner-border-sm" /> : '↻'} {isOkta ? 'Query Okta' : 'Search'}
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onReset} disabled={loading}>Reset</button>
            </div>
        </form>
    );
};
