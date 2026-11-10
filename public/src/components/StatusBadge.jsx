const StatusBadge = ({ status }) => {
    const colors = {
        ACTIVE: 'success', STAGED: 'info', PROVISIONED: 'info',
        RECOVERY: 'warning', PASSWORD_EXPIRED: 'warning', LOCKED_OUT: 'warning',
        SUSPENDED: 'warning', DEPROVISIONED: 'secondary',
    };
    return <span className={`badge bg-${colors[status] || 'dark'}`}>{status}</span>;
};

// SCIM `active` of a linked user (null: not known yet)
const ScimActiveBadge = ({ active }) => (
    active === null || active === undefined
        ? <span className="badge bg-light text-dark border">SCIM</span>
        : <span className={`badge ${active ? 'bg-success' : 'bg-secondary'}`}>SCIM {active ? 'active' : 'inactive'}</span>
);

// When the local row last saw a system's copy of the user ("synced 3m ago"), with ⚠ when the identity
// changed since (stale). system: 'okta' | 'scim'
const SyncInfo = ({ user, system, label }) => {
    const at = user[`${system}_synced_at`];
    const stale = user[`${system}_stale`];
    if (!at) return null;
    return (
        <span className={`small ${stale ? 'text-warning-emphasis' : 'text-muted'}`}
            title={`${label || system} last synced ${fmtTime(at)}${stale ? ' — identity changed since' : ''}`}>
            {stale && '⚠ '}{label ? `${label} ` : ''}synced {fmtAgo(at)}
        </span>
    );
};
