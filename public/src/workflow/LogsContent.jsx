// Per-node logs modal; urlFilter comes from the step's MODAL_CONFIG entry
const LogsContent = ({ onClose, urlFilter }) => (
    <>
        <div className="modal-body"><LogViewer urlFilter={urlFilter} /></div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
    </>
);
