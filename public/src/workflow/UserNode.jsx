// A single user on the canvas, added after Create User or via Show in Read Users.
// data: { user (local users row), onOpenModal, onRemove }
const UserNode = ({ id, data }) => {
    const { user, onOpenModal, onRemove } = data;
    return (
        <>
            <ReactFlow.NodeToolbar position="top">
                <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-info text-nowrap" onClick={() => onOpenModal('view_user', { user })}>👁 View</button>
                    <UserActionButtons user={user} onOpenModal={onOpenModal} />
                    <button className="btn btn-sm btn-outline-secondary" title="Remove from canvas" onClick={() => onRemove(id)}>✕</button>
                </div>
            </ReactFlow.NodeToolbar>
            <div className="fw-bold">{user.first_name} {user.last_name}</div>
            <div className="small text-muted">{user.email}</div>
            <span className="badge bg-light text-dark border mt-1">{user.source}</span>
        </>
    );
};
