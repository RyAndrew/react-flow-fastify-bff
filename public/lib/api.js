const api = (url, opts = {}) => fetch(url, { credentials: 'same-origin', ...opts }).then(async r => {
    const data = await r.json();
    return { ok: r.ok, status: r.status, data };
});

const apiPost = (url, body) => api(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});
