const Modal = ({ show, onClose, title, size, children }) => {
    if (!show) return null;
    return (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size || ''}`}>
                <div className="modal-content update-modal-min-height">
                    <div className="modal-header">
                        <h5 className="modal-title">{title}</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
};
