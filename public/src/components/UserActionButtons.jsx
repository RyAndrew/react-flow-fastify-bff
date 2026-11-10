// Per-user actions shared by the Read Users toolbar and user nodes on the canvas.
// Okta actions open that step's modal with the user preselected; SCIM opens the
// in-place SCIM operations modal for this user.
const USER_ACTIONS = [
    { modal: 'update',    label: 'Update',              color: 'primary' },
    { modal: 'lifecycle', label: 'Lifecycle',           color: 'warning' },
    { modal: 'delete',    label: 'Deactivate / Delete', color: 'danger' },
];

// Deletes an identity with no credential left (the server refuses one still linked to Okta or SCIM)
const deleteIdentity = async (user, onUserChanged) => {
    if (!confirm(`Delete the identity ${user.first_name || ''} ${user.last_name || ''} (${user.email})?`)) return;
    const { ok, data } = await api(`/api/v1/identities/${user.id}`, { method: 'DELETE' });
    if (!ok) { alert(data?.error || 'Delete failed'); return; }
    onUserChanged?.(user.id, null);
};

const UserActionButtons = ({ user, onOpenModal, onUserChanged }) => (
    <>
        {/* Identity without an Okta credential: create one for it */}
        {!user.okta_id && (
            <button className="btn btn-success btn-sm text-nowrap"
                onClick={() => onOpenModal('credential', { initialIdentityId: user.id })}>
                Create Okta credential
            </button>
        )}
        {USER_ACTIONS.map(({ modal, label, color }) => (
            <button key={modal} className={`btn btn-${color} btn-sm text-nowrap`}
                disabled={!user.okta_id}
                title={user.okta_id ? '' : 'Not in Okta yet — create it first'}
                onClick={() => onOpenModal(modal, { initialUserId: user.okta_id })}>
                {label}
            </button>
        ))}
        <button className="btn btn-outline-info btn-sm text-nowrap" onClick={() => onOpenModal('scim_user', { user })}>
            SCIM
        </button>
        <button className="btn btn-outline-secondary btn-sm text-nowrap" onClick={() => onOpenModal('edit_identity', { user })}>
            Edit identity
        </button>
        <button className="btn btn-outline-danger btn-sm text-nowrap"
            disabled={!!(user.okta_id || user.scim_id)}
            title={user.okta_id || user.scim_id ? 'Delete its Okta and SCIM users first' : 'Delete this identity (it has no credentials)'}
            onClick={() => deleteIdentity(user, onUserChanged)}>
            Delete identity
        </button>
    </>
);
