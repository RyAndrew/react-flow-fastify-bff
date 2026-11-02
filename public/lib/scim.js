const SCIM_RESOURCE_TYPES = ['Users', 'Groups'];
const SCIM_ACTIONS = ['list', 'get', 'create', 'replace', 'patch', 'setPassword', 'delete'];
const SCIM_USER_ONLY_ACTIONS = ['setPassword'];
const SCIM_ACTION_LABELS  = { list: 'List', get: 'Get', create: 'Create', replace: 'Replace', patch: 'Patch', setPassword: 'Set Password', delete: 'Delete' };
const SCIM_ACTION_METHODS = { list: 'GET', get: 'GET', create: 'POST', replace: 'PUT', patch: 'PATCH', setPassword: 'PATCH', delete: 'DELETE' };
const SCIM_ACTION_COLORS  = { list: 'primary', get: 'info', create: 'success', replace: 'warning', patch: 'secondary', setPassword: 'dark', delete: 'danger' };

// Okta-style SCIM password PatchOp: value object, no path
const buildScimPasswordPatch = (password) => ({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:PatchOp'],
    Operations: [{ op: 'replace', value: { password } }],
});

const SAMPLE_ADDRESS = { type: 'work', streetAddress: '100 Main St', locality: 'San Francisco', region: 'CA', postalCode: '94105', country: 'US', primary: true };

const buildScimUserPatch = ({ givenName, familyName, email, address }) => ({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:PatchOp'],
    Operations: [
        { op: 'replace', path: 'name.givenName', value: givenName },
        { op: 'replace', path: 'name.familyName', value: familyName },
        { op: 'replace', path: 'emails', value: [{ value: email, type: 'work', primary: true }] },
        { op: 'replace', path: 'addresses', value: [address] },
    ],
});

const getScimDefaultPayload = (resourceType, action) => {
    const ts = Date.now();
    const defaults = {
        Users: {
            create:  { schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], userName: `user.${ts}@example.com`, name: { givenName: 'Test', familyName: 'User' }, emails: [{ value: `user.${ts}@example.com`, type: 'work', primary: true }], active: true },
            replace: { schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], userName: 'testuser@example.com', name: { givenName: 'Updated', familyName: 'User' }, emails: [{ value: 'testuser@example.com', type: 'work', primary: true }], active: true },
            patch:   buildScimUserPatch({ givenName: 'Updated', familyName: 'User', email: `updated.${ts}@example.com`, address: SAMPLE_ADDRESS }),
        },
        Groups: {
            create:  { schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'], displayName: `Test Group ${ts}`, members: [] },
            replace: { schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'], displayName: 'Updated Group', members: [] },
            patch:   { schemas: ['urn:ietf:params:scim:schemas:core:2.0:PatchOp'], Operations: [{ op: 'replace', path: 'displayName', value: 'New Name' }] },
        },
    };
    const d = defaults[resourceType]?.[action];
    return d ? JSON.stringify(d, null, 2) : '';
};
