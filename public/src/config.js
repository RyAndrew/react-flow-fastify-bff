// Loaded after the component files: these tables reference components at load time.

const nodeTypes = { custom: CustomNode, user: UserNode };

const APP_TABS = [
    { id: 'workflow', label: 'Workflow' },
    { id: 'scim',     label: 'SCIM Client' },
    { id: 'logs',     label: 'Logs' },
];

const arrow = (source, target) => ({ id: `e-${source}-${target}`, source, target, markerEnd: { type: ReactFlow.MarkerType.ArrowClosed } });
const initialEdges = [
    arrow('identity', 'credential'),
    arrow('credential', 'read'),
    arrow('import', 'read'),
    arrow('read', 'update'),
    arrow('update', 'lifecycle'),
    arrow('lifecycle', 'delete'),
];

// Modal type → title + content mapping
const MODAL_CONFIG = {
    identity:       { title: 'Create Identity',           size: 'modal-lg', Content: CreateIdentityContent },
    edit_identity:  { title: 'Edit Identity',             size: 'modal-lg', Content: EditIdentityContent },
    credential:     { title: 'Create Credential — Okta',  size: 'modal-lg', Content: CreateCredentialContent },
    import:         { title: 'Import User from Okta',     size: 'modal-xl', Content: ImportUserContent },
    read:           { title: 'Users',                     size: 'modal-xl', Content: ReadUsersContent },
    update:         { title: 'Update User',               size: 'modal-lg', Content: UpdateUserContent },
    lifecycle:      { title: 'User Lifecycle',            size: 'modal-lg', Content: LifecycleContent },
    delete:         { title: 'Deactivate / Delete User',  size: '',         Content: DeleteContent },
    view_user:      { title: 'User Details',              size: 'modal-xl', Content: ViewUserContent },
    scim_user:      { title: 'SCIM Operations',           size: 'modal-lg', Content: ScimUserContent },
};

const NODE_TO_MODAL = { identity: 'identity', credential: 'credential', import: 'import', read: 'read', update: 'update', lifecycle: 'lifecycle', delete: 'delete' };

// Workflow node → Logs tab context: per-source filter overrides (see LOG_DEFAULT_FILTERS in lib/logs.js)
const NODE_LOG_CONTEXTS = {
    identity:   { label: 'Create Identity',            filters: { internal: { url: '/api/v1/identities' } } },
    credential: { label: 'Create Credential',          filters: { internal: { url: 'users/create' },                          okta: { filter: 'eventType eq "user.lifecycle.create"' } } },
    import:     { label: 'Import User',                filters: { internal: { url: '/okta/search,/import' } } },
    read:       { label: 'Users',                      filters: { internal: { url: '/api/v1/users' } } },
    update:     { label: 'Update User',                filters: { internal: { url: '/update,/credentials,/factors,/groups' }, okta: { filter: 'eventType sw "user.account" or eventType sw "user.mfa" or eventType sw "group.user_membership"' } } },
    lifecycle:  { label: 'Lifecycle',                  filters: { internal: { url: '/lifecycle/' },                           okta: { filter: 'eventType sw "user.lifecycle"' } } },
    delete:     { label: 'Deactivate / Delete',        filters: { internal: { url: '/deactivate' },                           okta: { filter: 'eventType eq "user.lifecycle.deactivate" or eventType sw "user.lifecycle.delete"' } } },
};

// Workflow node → SCIM preset mapping (a node without one has no ↗ SCIM button)
const NODE_SCIM_PRESETS = {
    credential: { resourceType: 'Users', action: 'create', requiresUser: false },
    import:     { resourceType: 'Users', action: 'list',   requiresUser: false },
    read:       { resourceType: 'Users', action: 'list',   requiresUser: false },
    update:     { resourceType: 'Users', action: 'patch',  requiresUser: true },
    lifecycle:  { resourceType: 'Users', action: 'patch',  requiresUser: true, patchOps: [{ op: 'replace', path: 'active', value: false }] },
    delete:     { resourceType: 'Users', action: 'delete', requiresUser: true },
};
