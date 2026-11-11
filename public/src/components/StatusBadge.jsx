const StatusBadge = ({ status }) => {
    const colors = {
        ACTIVE: 'success', STAGED: 'info', PROVISIONED: 'info',
        RECOVERY: 'warning', PASSWORD_EXPIRED: 'warning', LOCKED_OUT: 'warning',
        SUSPENDED: 'warning', DEPROVISIONED: 'secondary',
    };
    return <span className={`badge bg-${colors[status] || 'dark'}`}>{status}</span>;
};

// SCIM `active` of a linked account (null: not known yet); label defaults to 'SCIM' (e.g. the server name)
const ScimActiveBadge = ({ active, label = 'SCIM' }) => (
    active === null || active === undefined
        ? <span className="badge bg-light text-dark border">{label}</span>
        : <span className={`badge ${active ? 'bg-success' : 'bg-secondary'}`}>{label} {active ? 'active' : 'inactive'}</span>
);

// A user's account on one SCIM server (from user.scim_accounts), or undefined
const scimAccountFor = (user, serverId) =>
    user?.scim_accounts?.find(a => String(a.scim_server_id) === String(serverId));

// Display name of a SCIM account's server
const scimAccountLabel = (acc) => acc.server_name || `Server ${acc.scim_server_id}`;

// When the local row last saw a system's copy of the user ("synced 3m ago"), with ⚠ when the identity
// changed since (stale). Okta: at = user.okta_synced_at, stale = user.okta_stale; a SCIM account:
// at = account.synced_at, stale = account.stale.
const SyncInfo = ({ at, stale, label }) => {
    if (!at) return null;
    return (
        <span className={`small ${stale ? 'text-warning-emphasis' : 'text-muted'}`}
            title={`${label || 'Last'} synced ${fmtTime(at)}${stale ? ' — identity changed since' : ''}`}>
            {stale && '⚠ '}{label ? `${label} ` : ''}synced {fmtAgo(at)}
        </span>
    );
};
