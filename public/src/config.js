// Loaded after the component files: these tables reference components at load time.

const nodeTypes = { custom: CustomNode };

const initialEdges = [
    { id: 'e1-2', source: '1', target: '2', markerEnd: { type: ReactFlow.MarkerType.ArrowClosed } },
    { id: 'e2-3', source: '2', target: '3', markerEnd: { type: ReactFlow.MarkerType.ArrowClosed } },
    { id: 'e3-4', source: '3', target: '4', markerEnd: { type: ReactFlow.MarkerType.ArrowClosed } },
];

// Modal type → title + content mapping
const MODAL_CONFIG = {
    create:         { title: 'Create User',               size: 'modal-lg', Content: CreateUserContent },
    update:         { title: 'Update User',               size: 'modal-lg', Content: UpdateUserContent },
    lifecycle:      { title: 'User Lifecycle',            size: 'modal-lg', Content: LifecycleContent },
    delete:         { title: 'Deactivate / Delete User',  size: '',         Content: DeleteContent },
    logs_create:    { title: 'Logs: Create User',         size: 'modal-xl', Content: LogsContent, props: { urlFilter: 'users/create' } },
    logs_update:    { title: 'Logs: Update User',         size: 'modal-xl', Content: LogsContent, props: { urlFilter: '/update,/credentials,/factors,/groups' } },
    logs_lifecycle: { title: 'Logs: Lifecycle',           size: 'modal-xl', Content: LogsContent, props: { urlFilter: '/lifecycle/' } },
    logs_delete:    { title: 'Logs: Deactivate / Delete', size: 'modal-xl', Content: LogsContent, props: { urlFilter: '/deactivate' } },
};

const NODE_TO_MODAL = { '1': 'create', '2': 'update', '3': 'lifecycle', '4': 'delete' };
const NODE_TO_LOGS  = { '1': 'logs_create', '2': 'logs_update', '3': 'logs_lifecycle', '4': 'logs_delete' };

// Workflow node → SCIM preset mapping
const NODE_SCIM_PRESETS = {
    '1': { resourceType: 'Users', action: 'create', requiresUser: false },
    '2': { resourceType: 'Users', action: 'patch',  requiresUser: true },
    '3': { resourceType: 'Users', action: 'patch',  requiresUser: true, patchOps: [{ op: 'replace', path: 'active', value: false }] },
    '4': { resourceType: 'Users', action: 'delete', requiresUser: true },
};
