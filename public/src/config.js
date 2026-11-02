// Loaded after the component files: these tables reference components at load time.

const nodeTypes = { custom: CustomNode };

const initialEdges = [
    { id: 'e-create-read',    source: 'create',  target: 'read',    markerEnd: { type: ReactFlow.MarkerType.ArrowClosed } },
    { id: 'e-import-read',    source: 'import',  target: 'read',    markerEnd: { type: ReactFlow.MarkerType.ArrowClosed } },
    { id: 'e-read-update',    source: 'read',    target: 'update',  markerEnd: { type: ReactFlow.MarkerType.ArrowClosed } },
    { id: 'e-update-suspend', source: 'update',  target: 'suspend', markerEnd: { type: ReactFlow.MarkerType.ArrowClosed } },
    { id: 'e-suspend-delete', source: 'suspend', target: 'delete',  markerEnd: { type: ReactFlow.MarkerType.ArrowClosed } },
];

// Modal type → title + content mapping
const MODAL_CONFIG = {
    create:         { title: 'Create User',               size: 'modal-lg', Content: CreateUserContent },
    import:         { title: 'Import User from Okta',     size: 'modal-xl', Content: ImportUserContent },
    read:           { title: 'Users',                     size: 'modal-xl', Content: ReadUsersContent },
    update:         { title: 'Update User',               size: 'modal-lg', Content: UpdateUserContent },
    lifecycle:      { title: 'User Lifecycle',            size: 'modal-lg', Content: LifecycleContent },
    delete:         { title: 'Deactivate / Delete User',  size: '',         Content: DeleteContent },
    logs_create:    { title: 'Logs: Create User',         size: 'modal-xl', Content: LogsContent, props: { urlFilter: 'users/create' } },
    logs_import:    { title: 'Logs: Import User',         size: 'modal-xl', Content: LogsContent, props: { urlFilter: '/okta/search,/import' } },
    logs_read:      { title: 'Logs: Users',              size: 'modal-xl', Content: LogsContent, props: { urlFilter: '/api/v1/users' } },
    logs_update:    { title: 'Logs: Update User',         size: 'modal-xl', Content: LogsContent, props: { urlFilter: '/update,/credentials,/factors,/groups' } },
    logs_lifecycle: { title: 'Logs: Lifecycle',           size: 'modal-xl', Content: LogsContent, props: { urlFilter: '/lifecycle/' } },
    logs_delete:    { title: 'Logs: Deactivate / Delete', size: 'modal-xl', Content: LogsContent, props: { urlFilter: '/deactivate' } },
};

const NODE_TO_MODAL = { create: 'create', import: 'import', read: 'read', update: 'update', suspend: 'lifecycle', delete: 'delete' };
const NODE_TO_LOGS  = { create: 'logs_create', import: 'logs_import', read: 'logs_read', update: 'logs_update', suspend: 'logs_lifecycle', delete: 'logs_delete' };

// Workflow node → SCIM preset mapping
const NODE_SCIM_PRESETS = {
    create:  { resourceType: 'Users', action: 'create', requiresUser: false },
    import:  { resourceType: 'Users', action: 'list',   requiresUser: false },
    read:    { resourceType: 'Users', action: 'list',   requiresUser: false },
    update:  { resourceType: 'Users', action: 'patch',  requiresUser: true },
    suspend: { resourceType: 'Users', action: 'patch',  requiresUser: true, patchOps: [{ op: 'replace', path: 'active', value: false }] },
    delete:  { resourceType: 'Users', action: 'delete', requiresUser: true },
};
