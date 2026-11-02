const CustomNode = ({ data, id }) => (
    <>
        <ReactFlow.Handle type="target" position={ReactFlow.Position.Top} />
        <ReactFlow.NodeToolbar position="top">
            <button className="btn btn-sm btn-success me-2" onClick={() => data.onRun(id)}>▶ Run</button>
            <button className="btn btn-sm btn-primary me-2" onClick={() => data.onViewLogs(id)}>📄 View Logs</button>
            <button className="btn btn-sm btn-outline-info" onClick={() => data.onScimNavigate(id)}>↗ SCIM</button>
        </ReactFlow.NodeToolbar>
        <div>{data.label}</div>
        <ReactFlow.Handle type="source" position={ReactFlow.Position.Bottom} />
    </>
);
