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
