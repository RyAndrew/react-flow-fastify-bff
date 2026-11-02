const App = () => {
    const { isAuthenticated, isLoading, user, logout, refresh, loginRedirect, showExpiry, loggedOut, countdown } = useAuth();
    const [view, setView] = React.useState('workflow'); // 'workflow' | 'scim'
    const [modalType, setModalType] = React.useState(null);
    const [scimPreset, setScimPreset] = React.useState(null);
    const [selectedScimServerId, setSelectedScimServerId] = React.useState('');
    const [authError] = React.useState(() => {
        const params = new URLSearchParams(window.location.search);
        const err = params.get('error');
        if (err) history.replaceState(null, '', window.location.pathname);
        return err || null;
    });

    const closeModal = React.useCallback(() => setModalType(null), []);

    const handleRun = React.useCallback((nodeId) => {
        setModalType(NODE_TO_MODAL[nodeId] || null);
    }, []);

    const handleViewLogs = React.useCallback((nodeId) => {
        setModalType(NODE_TO_LOGS[nodeId] || 'logs_create');
    }, []);

    const handleScimNavigate = React.useCallback((nodeId) => {
        setScimPreset(NODE_SCIM_PRESETS[nodeId] || null);
        setView('scim');
    }, []);

    const initialNodes = [
        { id: '1', type: 'custom', data: { label: '1. Create User',  onRun: handleRun, onViewLogs: handleViewLogs, onScimNavigate: handleScimNavigate }, position: { x: 250, y: 50 },  className: 'create' },
        { id: '2', type: 'custom', data: { label: '2. Update User',  onRun: handleRun, onViewLogs: handleViewLogs, onScimNavigate: handleScimNavigate }, position: { x: 250, y: 150 }, className: 'update' },
        { id: '3', type: 'custom', data: { label: '3. Suspend User', onRun: handleRun, onViewLogs: handleViewLogs, onScimNavigate: handleScimNavigate }, position: { x: 250, y: 250 }, className: 'suspend' },
        { id: '4', type: 'custom', data: { label: '4. Delete User',  onRun: handleRun, onViewLogs: handleViewLogs, onScimNavigate: handleScimNavigate }, position: { x: 250, y: 350 }, className: 'delete' },
    ];

    const [nodes, setNodes] = React.useState(initialNodes);
    const [edges, setEdges] = React.useState(initialEdges);
    const onNodesChange = React.useCallback((c) => setNodes(n => ReactFlow.applyNodeChanges(c, n)), []);
    const onEdgesChange = React.useCallback((c) => setEdges(e => ReactFlow.applyEdgeChanges(c, e)), []);

    if (isLoading) return <LoadingScreen />;

    if (authError) return <AuthErrorScreen message={authError} onRetry={login} />;

    if (loggedOut || !isAuthenticated) return <SessionExpiredScreen onLogin={login} />;

    const cfg = modalType ? MODAL_CONFIG[modalType] : null;

    return (
        <div className="container-fluid h-100 p-0">
            <nav className="navbar navbar-dark bg-dark">
                <div className="container-fluid">
                    <span className="navbar-brand mb-0 h1">User Management Process Flow</span>
                    <div className="d-flex align-items-center gap-2">
                        <button className={`btn btn-sm ${view === 'workflow' ? 'btn-light' : 'btn-outline-light'}`} onClick={() => setView('workflow')}>Workflow</button>
                        <button className={`btn btn-sm ${view === 'scim' ? 'btn-light' : 'btn-outline-light'}`} onClick={() => setView('scim')}>SCIM Client</button>
                        <span className="text-light ms-2">{user?.name}</span>
                        <button className="btn btn-outline-light btn-sm" onClick={logout}>Logout</button>
                    </div>
                </div>
            </nav>
            {view === 'workflow' ? (
                <div style={{ height: 'calc(100vh - 56px)' }}>
                    <ReactFlow.ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypes} fitView>
                        <ReactFlow.Controls />
                        <ReactFlow.Background variant="dots" gap={12} size={1} />
                    </ReactFlow.ReactFlow>
                </div>
            ) : (
                <ScimClient
                    preset={scimPreset}
                    onClearPreset={() => setScimPreset(null)}
                    serverId={selectedScimServerId}
                    onServerIdChange={setSelectedScimServerId}
                />
            )}
            {cfg && (
                <Modal show={true} onClose={closeModal} title={cfg.title} size={cfg.size}>
                    <cfg.Content onClose={closeModal} {...cfg.props} />
                </Modal>
            )}
            {showExpiry && <SessionExpiryDialog countdown={countdown} onRefresh={refresh} onLogout={logout} />}
        </div>
    );
};
