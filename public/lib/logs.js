// Log sources shown in the Logs tab. internal + scim both read the BFF access log (log_access);
// scim is narrowed server-side to /api/v1/scim/ requests. okta proxies the Okta System Log.
const LOG_SOURCES = [
    { id: 'internal', label: 'Internal' },
    { id: 'scim',     label: 'SCIM Client' },
    { id: 'okta',     label: 'Okta System Log' },
];

const LOG_TIME_WINDOWS = [
    { value: '15m', label: 'Last 15 minutes', ms: 15 * 60e3 },
    { value: '1h',  label: 'Last hour',       ms: 60 * 60e3 },
    { value: '24h', label: 'Last 24 hours',   ms: 24 * 3600e3 },
    { value: '7d',  label: 'Last 7 days',     ms: 7 * 86400e3 },
    { value: '30d', label: 'Last 30 days',    ms: 30 * 86400e3 },
    { value: '',    label: 'Any time' },  // Okta itself caps this at the last 7 days
];

const ACCESS_LOG_DEFAULTS = { url: '', method: '', status: '', q: '', since: '24h', hideLogQueries: true, limit: '50' };

const LOG_DEFAULT_FILTERS = {
    internal: ACCESS_LOG_DEFAULTS,
    scim:     ACCESS_LOG_DEFAULTS,
    okta:     { filter: '', q: '', since: '24h', limit: '50' },
};

// Filters for every source, with a context's per-source overrides applied
// (context: { label, filters: { internal?: {...}, scim?: {...}, okta?: {...} } })
const logFiltersFor = (context) => Object.fromEntries(LOG_SOURCES.map(({ id }) =>
    [id, { ...LOG_DEFAULT_FILTERS[id], ...context?.filters?.[id] }]));

const sinceIso = (windowValue) => {
    const w = LOG_TIME_WINDOWS.find(t => t.value === windowValue);
    return w?.ms ? new Date(Date.now() - w.ms).toISOString() : '';
};

// cursor is the `next` value from the previous page (before_id for access logs, after for Okta)
const buildLogQueryUrl = (source, f, cursor) => {
    const qs = new URLSearchParams({ limit: f.limit || '50' });
    const set = (k, v) => { if (v) qs.set(k, v); };
    set('since', sinceIso(f.since));
    set('q', f.q?.trim());

    if (source === 'okta') {
        set('filter', f.filter?.trim());
        set('after', cursor);
        return `/api/v1/logs/okta?${qs}`;
    }

    if (source === 'scim') qs.set('scope', 'scim');
    set('url_contains', f.url?.trim());
    set('method', f.method);
    set('status', f.status);
    if (f.hideLogQueries) qs.set('exclude_self', '1');
    set('before_id', cursor);
    return `/api/v1/logs?${qs}`;
};

// log_access.created_at is SQLite CURRENT_TIMESTAMP: UTC with no zone marker ('2026-11-02 14:05:09')
const fmtSqliteTime = (ts) => {
    const d = new Date(/^\d{4}-\d\d-\d\d \d/.test(ts) ? `${ts.replace(' ', 'T')}Z` : ts);
    return isNaN(d) ? String(ts) : d.toLocaleString();
};

// Applied filters as short labels for the summary line, e.g. ['URL ~ users/create', 'Last 24 hours']
const describeLogFilters = (source, f) => {
    const out = [];
    if (source === 'scim') out.push('URL ~ /api/v1/scim/');
    if (f.url?.trim()) out.push(`URL ~ ${f.url.trim()}`);
    if (f.method) out.push(`Method = ${f.method}`);
    if (f.status) out.push(`Status ${f.status}`);
    if (f.filter?.trim()) out.push(`filter: ${f.filter.trim()}`);
    if (f.q?.trim()) out.push(`Text "${f.q.trim()}"`);
    out.push(LOG_TIME_WINDOWS.find(t => t.value === f.since)?.label || 'Any time');
    if (source !== 'okta' && f.hideLogQueries) out.push('Hiding log queries');
    return out;
};
