// Per-user actions shared by the Read Users toolbar and user nodes on the canvas.
// Okta actions open that step's modal with the user preselected; SCIM opens the
// in-place SCIM operations modal for this user.
const USER_ACTIONS = [
    { modal: 'update',    label: 'Update',              color: 'primary' },
    { modal: 'lifecycle', label: 'Lifecycle',           color: 'warning' },
    { modal: 'delete',    label: 'Deactivate / Delete', color: 'danger' },
];

const UserActionButtons = ({ user, onOpenModal }) => (
    <>
        {/* SCIM import not yet in Okta: offer Create, prefilled from the import */}
        {user.source === 'scim' && !user.okta_id && (
            <button className="btn btn-success btn-sm text-nowrap"
                onClick={() => onOpenModal('create', { initialImportedId: user.id })}>
                Create
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
    </>
);
