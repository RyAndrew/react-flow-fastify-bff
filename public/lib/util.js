const api = (url, opts = {}) => fetch(url, { credentials: 'same-origin', ...opts }).then(async r => {
    const data = await r.json();
    return { ok: r.ok, status: r.status, data };
});

const apiPost = (url, body) => api(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

// One row from the local users table (the source of truth for a user), or null
const fetchLocalUser = (id) => api(`/api/v1/users/local/${encodeURIComponent(id)}`).then(({ ok, data }) => (ok ? data.user : null));

// Nested object → [['profile.firstName', 'Jane'], ['emails.0.value', 'j@x.com'], ...]; arrays of primitives are joined
const flattenObject = (obj, prefix = '') => Object.entries(obj || {}).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    const primitiveArray = Array.isArray(v) && v.every(x => x === null || typeof x !== 'object');
    if (v && typeof v === 'object' && !primitiveArray) return flattenObject(v, key);
    return [[key, primitiveArray ? v.join(', ') : v]];
});

// ISO or SQLite (UTC 'YYYY-MM-DD HH:MM:SS') timestamp → local date/time, '—' when empty
const fmtTime = (v) => {
    if (!v) return '—';
    const d = new Date(/^\d{4}-\d\d-\d\d \d/.test(v) ? `${v.replace(' ', 'T')}Z` : v);
    return isNaN(d) ? String(v) : d.toLocaleString();
};

// Timestamp → "just now" / "3m ago" / "2h ago" / "5d ago" (full time in fmtTime), '—' when empty
const fmtAgo = (v) => {
    if (!v) return '—';
    const d = new Date(/^\d{4}-\d\d-\d\d \d/.test(v) ? `${v.replace(' ', 'T')}Z` : v);
    if (isNaN(d)) return String(v);
    const s = Math.max(0, (Date.now() - d) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
};

const fmtJson =(v) => { try { return JSON.stringify(typeof v === 'string' ? JSON.parse(v) : v, null, 2); } catch { return String(v); } };

const generatePassword = (length = 16) => {
    const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*-_=+'];
    const all = sets.join('');
    const rand = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
    // One char from each set guarantees complexity rules, rest random, then shuffle
    const chars = sets.map(s => s[rand(s.length)]);
    while (chars.length < length) chars.push(all[rand(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) { const j = rand(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    return chars.join('');
};
