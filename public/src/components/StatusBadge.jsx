const StatusBadge = ({ status }) => {
    const colors = {
        ACTIVE: 'success', STAGED: 'info', PROVISIONED: 'info',
        RECOVERY: 'warning', PASSWORD_EXPIRED: 'warning', LOCKED_OUT: 'warning',
        SUSPENDED: 'warning', DEPROVISIONED: 'secondary',
    };
    return <span className={`badge bg-${colors[status] || 'dark'}`}>{status}</span>;
};
