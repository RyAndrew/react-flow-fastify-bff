// Create-user payload templates: {{token}} rendering, token docs for the help modal, and initial-status tables.
// Templates are stored in SQLite (/api/v1/templates) as JSON text with tokens inside.

const USER_TEMPLATE_TARGETS = { okta: 'Okta', scim: 'SCIM' };

// Initial status per target. Okta: query params for POST /users/create, password → credentials.password.value.
// SCIM: sets `active` and adds/removes the top-level `password` (AD rejects an enabled account with no password).
const USER_CREATE_STATUSES = {
    okta: [
        { value: 'STAGED',           label: 'STAGED — created, not activated',                       query: { activate: 'false' } },
        { value: 'PROVISIONED',      label: 'PROVISIONED — activated, user sets password via email', query: { activate: 'true' } },
        { value: 'ACTIVE',           label: 'ACTIVE — activated with a password',                    query: { activate: 'true' }, password: true },
        { value: 'PASSWORD_EXPIRED', label: 'PASSWORD_EXPIRED — must change password at next login', query: { activate: 'true', nextLogin: 'changePassword' }, password: true },
    ],
    scim: [
        { value: 'ACTIVE',               label: 'Active — enabled, with a password',   active: true,  password: true },
        { value: 'INACTIVE',             label: 'Inactive — disabled, with a password', active: false, password: true },
        { value: 'INACTIVE_NO_PASSWORD', label: 'Inactive — disabled, no password',     active: false, password: false },
    ],
};
const DEFAULT_CREATE_STATUS = { okta: 'PROVISIONED', scim: 'ACTIVE' };

// Make a parsed payload match the chosen status; an existing password value is kept
const applyUserStatus = (target, body, statusValue) => {
    const s = USER_CREATE_STATUSES[target].find(x => x.value === statusValue);
    if (!s) return body;
    if (target === 'okta') {
        const { credentials, ...rest } = body;
        if (!s.password) return rest;
        return { ...rest, credentials: { password: { value: credentials?.password?.value || generatePassword() } } };
    }
    const { password, ...rest } = body;
    return { ...rest, ...(s.password ? { password: password || generatePassword() } : {}), active: s.active };
};

const randomChars = (chars, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), x => chars[x % chars.length]).join('');
const LOWER_ALNUM = 'abcdefghijkmnpqrstuvwxyz23456789';
const slugify = (v) => String(v).toLowerCase().replace(/[^a-z0-9._-]/g, '');

// Everything the help modal lists. `example` is shown verbatim.
const TEMPLATE_TOKENS = [
    {
        group: 'Person',
        note: 'From the random name generator, or from the user picked in "Prefill from".',
        tokens: [
            { token: '{{firstName}}',  desc: 'Given name' },
            { token: '{{middleName}}', desc: 'Middle name (empty when prefilled from a user)' },
            { token: '{{lastName}}',   desc: 'Surname' },
            { token: '{{gender}}',     desc: 'Gender from the random name generator (empty when prefilled)' },
            { token: '{{email}}',      desc: 'Prefilled user\'s email, else firstname.lastname+{{suffix}}@example.com' },
            { token: '{{login}}',      desc: 'Prefilled user\'s login, else the same as {{email}}' },
            { token: '{{sam}}',        desc: 'AD-style account name: first initial + surname + {{suffix}}, at most 20 characters' },
        ],
    },
    {
        group: 'Generated once per render',
        note: 'The same value everywhere it appears in one payload; a new value each time the payload is regenerated.',
        tokens: [
            { token: '{{suffix}}',    desc: '5 random lowercase letters/digits, e.g. k3m9x' },
            { token: '{{password}}',  desc: '16-character password with upper, lower, digit and symbol' },
            { token: '{{uuid}}',      desc: 'Random UUID' },
            { token: '{{timestamp}}', desc: 'Milliseconds since epoch' },
            { token: '{{date}}',      desc: 'Today as YYYY-MM-DD' },
        ],
    },
    {
        group: 'Random at every use',
        note: 'A fresh value at each occurrence.',
        tokens: [
            { token: '{{random:N}}',     desc: 'N random lowercase letters/digits (default 8)' },
            { token: '{{digits:N}}',     desc: 'N random digits (default 6)' },
            { token: '{{alpha:N}}',      desc: 'N random lowercase letters (default 6)' },
            { token: '{{pick:a,b,c}}',   desc: 'One of the comma-separated values' },
        ],
    },
];

const TEMPLATE_MODIFIERS = [
    { token: '|lower',   desc: 'Lowercase',                                example: '{{lastName|lower}}' },
    { token: '|upper',   desc: 'Uppercase',                                example: '{{lastName|upper}}' },
    { token: '|slug',    desc: 'Lowercase, keep only a-z 0-9 . _ -',       example: '{{lastName|slug}}' },
    { token: '|initial', desc: 'First character',                          example: '{{firstName|initial}}{{lastName|lower}}' },
    { token: '|trunc:N', desc: 'First N characters',                       example: '{{lastName|lower|trunc:8}}' },
];

const RANDOM_TOKENS = {
    random: (n) => randomChars(LOWER_ALNUM, Number(n) || 8),
    digits: (n) => randomChars('0123456789', Number(n) || 6),
    alpha:  (n) => randomChars('abcdefghijklmnopqrstuvwxyz', Number(n) || 6),
    pick:   (list) => { const opts = (list || '').split(',').map(s => s.trim()); return opts[crypto.getRandomValues(new Uint32Array(1))[0] % opts.length]; },
};

const MODIFIERS = {
    lower:   (v) => v.toLowerCase(),
    upper:   (v) => v.toUpperCase(),
    slug:    slugify,
    initial: (v) => v.slice(0, 1),
    trunc:   (v, n) => v.slice(0, Number(n) || v.length),
};

// person: { firstName, middleName?, lastName, gender?, email?, login? }
const buildTokenContext = (person) => {
    const firstName = person.firstName || '';
    const lastName = person.lastName || '';
    const suffix = randomChars(LOWER_ALNUM, 5);
    const email = person.email || `${slugify(firstName)}.${slugify(lastName)}+${suffix}@example.com`;
    const sam = `${firstName.slice(0, 1)}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) + suffix;
    return {
        firstName, lastName, email, sam, suffix,
        middleName: person.middleName || '',
        gender: person.gender || '',
        login: person.login || email,
        password: generatePassword(16),
        uuid: crypto.randomUUID(),
        timestamp: String(Date.now()),
        date: new Date().toISOString().slice(0, 10),
    };
};

// Replace {{name[:arg][|modifier[:arg]]...}} in a template body. Values are JSON-string-escaped, so tokens
// belong inside "quoted" strings (an unquoted {{digits:N}} still yields a valid number). Throws on unknown tokens.
const renderUserTemplate = (body, person) => {
    const ctx = buildTokenContext(person);
    const unknown = [];
    const out = body.replace(/\{\{([^{}]+)\}\}/g, (match, inner) => {
        const [head, ...mods] = inner.split('|').map(s => s.trim());
        const [name, ...argParts] = head.split(':');
        const arg = argParts.join(':');
        let value;
        if (RANDOM_TOKENS[name]) value = RANDOM_TOKENS[name](arg);
        else if (name in ctx) value = ctx[name];
        else { unknown.push(match); return match; }
        for (const mod of mods) {
            const [modName, modArg] = mod.split(':');
            if (!MODIFIERS[modName]) { unknown.push(match); return match; }
            value = MODIFIERS[modName](String(value), modArg);
        }
        return JSON.stringify(String(value)).slice(1, -1);
    });
    if (unknown.length) throw new Error(`Unknown token or modifier: ${[...new Set(unknown)].join(', ')}`);
    return out;
};

// Render + parse + apply status → pretty JSON string. Throws with a readable message on bad templates.
const buildUserPayload = (template, person, target, statusValue) => {
    const rendered = renderUserTemplate(template.body, person);
    let parsed;
    try { parsed = JSON.parse(rendered); }
    catch (e) { throw new Error(`Template "${template.name}" is not valid JSON after rendering: ${e.message}`); }
    return JSON.stringify(applyUserStatus(target, parsed, statusValue), null, 2);
};
