const SessionExpiredScreen = ({ onLogin }) => (
    <div className="loading-screen">
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-danger">
                    <div className="modal-header bg-danger text-white">
                        <h5 className="modal-title">Session Expired</h5>
                    </div>
                    <div className="modal-body text-center">
                        <p className="mb-1">Your session has expired due to inactivity.</p>
                        <p className="text-muted small mb-0">Please log in again to continue.</p>
                    </div>
                    <div className="modal-footer justify-content-center">
                        <button className="btn btn-primary btn-lg" onClick={onLogin}>Log In</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
);
