const App = () => {
    const { isAuthenticated, isLoading, user, logout, refresh, login, showExpiry, loggedOut, countdown } = useAuth();
    const [view, setView] = React.useState('workflow'); // 'workflow' | 'scim' | 'logs'
    const [modal, setModal] = React.useState(null); // { type, props }
    const [logRequest, setLogRequest] = React.useState(null); // { source, context, nonce } → LogsView
    const [scimPreset, setScimPreset] = React.useState(null);
    const [selectedScimServerId, setSelectedScimServerId] = React.useState('');
    const [authError] = React.useState(() => {
        const params = new URLSearchParams(window.location.search);
        const err = params.get('error');
        if (err) history.replaceState(null, '', window.location.pathname);
        return err || null;
    });

    const closeModal = React.useCallback(() => setModal(null), []);

    // props are passed through to the modal's Content (e.g. { initialUserId })
    const openModal = React.useCallback((type, props) => {
        setModal(type ? { type, props } : null);
    }, []);

    const handleRun = React.useCallback((nodeId) => {
        openModal(NODE_TO_MODAL[nodeId]);
    }, [openModal]);

    // Switch to the Logs tab with a source and context filters (context: { label, filters } or null)
    const openLogs = React.useCallback((source, context) => {
        setModal(null);
        setLogRequest({ source, context, nonce: Date.now() });
        setView('logs');
    }, []);

    const handleViewLogs = React.useCallback((nodeId) => {
        openLogs('internal', NODE_LOG_CONTEXTS[nodeId] || null);
    }, [openLogs]);

    // Switch to the SCIM client with a preset ({ resourceType, action, requiresUser, scimId?, serverId?, patchOps? })
    const openScim = React.useCallback((preset) => {
        setModal(null);
        setScimPreset(preset);
        setView('scim');
    }, []);

    const handleScimNavigate = React.useCallback((nodeId) => {
        openScim(NODE_SCIM_PRESETS[nodeId] || null);
    }, [openScim]);

    // Workflow steps: Create Identity (who the person is) → Create Credential (an Okta account bound to an
    // identity) → manage. Import brings in an identity with its existing Okta credential.
    const stepNode = (id, label, x, y) => ({
        id, type: 'custom', position: { x, y }, className: id,
        data: { label, hasScim: !!NODE_SCIM_PRESETS[id], onRun: handleRun, onViewLogs: handleViewLogs, onScimNavigate: handleScimNavigate },
    });
    const initialNodes = [
        stepNode('identity',   'Create Identity',   250, 50),
        stepNode('import',     'Import User',       500, 50),
        stepNode('credential', 'Create Credential', 250, 150),
        stepNode('read',       'Read Users',        250, 250),
        stepNode('update',     'Update User',       250, 350),
        stepNode('lifecycle',  'Lifecycle',         250, 450),
        stepNode('delete',     'Delete User',       250, 550),
    ];

    const [nodes, setNodes] = React.useState(initialNodes);
    const [edges, setEdges] = React.useState(initialEdges);
    const onNodesChange = React.useCallback((c) => setNodes(n => ReactFlow.applyNodeChanges(c, n)), []);
    const onEdgesChange = React.useCallback((c) => setEdges(e => ReactFlow.applyEdgeChanges(c, e)), []);
    const flowRef = React.useRef(null);
    // The canvas unmounts in the other tabs; drop its instance so showUserNode doesn't fit a stale one
    // (React Flow fits all nodes again when it remounts)
    React.useEffect(() => { if (view !== 'workflow') flowRef.current = null; }, [view]);

    const removeNode = React.useCallback((nodeId) => {
        setNodes(ns => ns.filter(n => n.id !== nodeId));
    }, []);

    // A user changed in the local DB: give its node (if one is on the canvas) the stored row, or remove the
    // node when the row was deleted (row = null). Doesn't add, select or move nodes.
    const onUserChanged = React.useCallback((localId, row) => {
        const id = `user-${localId}`;
        setNodes(ns => (row
            ? ns.map(n => n.id === id ? { ...n, data: { ...n.data, user: row } } : n)
            : ns.filter(n => n.id !== id)));
    }, []);

    // Adds a floating user node left of the workflow (or refreshes and selects it if already shown).
    // `user` is a row from the local users table.
    const showUserNode = React.useCallback((user) => {
        const id = `user-${user.id}`;
        setNodes(ns => {
            const data = { user, onOpenModal: openModal, onRemove: removeNode, onUserChanged };
            if (ns.some(n => n.id === id)) {
                return ns.map(n => n.id === id ? { ...n, data, selected: true } : { ...n, selected: false });
            }
            const userNodeCount = ns.filter(n => n.type === 'user').length;
            const node = { id, type: 'user', data, position: { x: -150, y: 50 + userNodeCount * 110 }, className: 'user', selected: true };
            return [...ns.map(n => ({ ...n, selected: false })), node];
        });
        // Bring the new node into view once React Flow has measured it
        setTimeout(() => flowRef.current?.fitView({ padding: 0.2, duration: 300 }), 50);
    }, [openModal, removeNode, onUserChanged]);

    if (isLoading) return <LoadingScreen />;

    if (authError) return <AuthErrorScreen message={authError} onRetry={login} />;

    if (loggedOut || !isAuthenticated) return <SessionExpiredScreen onLogin={login} />;

    const cfg = modal ? MODAL_CONFIG[modal.type] : null;

    return (
        <div className="container-fluid h-100 p-0">
            <nav className="navbar navbar-dark bg-dark app-navbar">
                <div className="container-fluid h-100">
                    <span className="navbar-brand mb-0 h1">User Management Process Flow</span>
                    <ul className="nav nav-tabs app-tabs me-auto">
                        {APP_TABS.map(t => (
                            <li className="nav-item" key={t.id}>
                                <button className={`nav-link ${view === t.id ? 'active' : ''}`} onClick={() => setView(t.id)}>{t.label}</button>
                            </li>
                        ))}
                    </ul>
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-light">{user?.name}</span>
                        <button className="btn btn-outline-light btn-sm" onClick={logout}>Logout</button>
                    </div>
                </div>
            </nav>
            {/* React Flow needs a visible container to measure, so the canvas mounts only on its tab;
                the SCIM client and logs stay mounted (hidden) to keep their state across tab switches */}
            {view === 'workflow' && (
                <div style={{ height: 'calc(100vh - 56px)' }}>
                    <ReactFlow.ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypes} onInit={i => { flowRef.current = i; }} fitView>
                        <ReactFlow.Controls />
                        <ReactFlow.Background variant="dots" gap={12} size={1} />
                    </ReactFlow.ReactFlow>
                </div>
            )}
            <div className={view === 'scim' ? '' : 'd-none'}>
                <ScimClient
                    preset={scimPreset}
                    onClearPreset={() => setScimPreset(null)}
                    serverId={selectedScimServerId}
                    onServerIdChange={setSelectedScimServerId}
                    onShowUser={showUserNode}
                    onUserChanged={onUserChanged}
                    onGoToCanvas={() => setView('workflow')}
                    onViewLogs={(context) => openLogs('scim', context)}
                />
            </div>
            <div className={view === 'logs' ? '' : 'd-none'}>
                <LogsView request={logRequest} active={view === 'logs'} />
            </div>
            {cfg && (
                <Modal show={true} onClose={closeModal} title={cfg.title} size={cfg.size}>
                    <cfg.Content onClose={closeModal} onOpenModal={openModal} onScimNavigate={handleScimNavigate} onOpenScim={openScim} onShowUser={showUserNode} onUserChanged={onUserChanged} {...cfg.props} {...modal.props} />
                </Modal>
            )}
            {showExpiry && <SessionExpiryDialog countdown={countdown} onRefresh={refresh} onLogout={logout} />}
        </div>
    );
};
