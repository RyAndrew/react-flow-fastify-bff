const SessionExpiryDialog = ({ countdown, onRefresh, onLogout }) => (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000 }}>
        <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-warning">
                <div className="modal-header bg-warning">
                    <h5 className="modal-title">Session Expiring</h5>
                </div>
                <div className="modal-body text-center">
                    <p className="mb-1">Your session will expire in</p>
                    <h2 className="text-danger fw-bold">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</h2>
                    <p className="text-muted small mb-0">Click below to stay signed in, or you will be logged out automatically.</p>
                </div>
                <div className="modal-footer justify-content-center">
                    <button className="btn btn-success btn-lg" onClick={onRefresh}>Stay Signed In</button>
                    <button className="btn btn-outline-secondary" onClick={onLogout}>Logout Now</button>
                </div>
            </div>
        </div>
    </div>
);
