const AuthErrorScreen = ({ message, onRetry }) => (
    <div className="loading-screen">
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-danger">
                    <div className="modal-header bg-danger text-white">
                        <h5 className="modal-title">Authentication Error</h5>
                    </div>
                    <div className="modal-body">
                        <p className="mb-0">{message}</p>
                    </div>
                    <div className="modal-footer justify-content-center">
                        <button className="btn btn-primary btn-lg" onClick={onRetry}>Try Again</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
);
