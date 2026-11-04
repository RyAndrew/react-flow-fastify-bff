// Help for the create-user form: features, every template token and modifier. Rendered in a portal
// because it opens on top of other modals.
const TemplateTokenHelp = ({ onClose }) => ReactDOM.createPortal(
    <Modal show={true} onClose={onClose} title="Create User — Templates & Tokens" size="modal-lg">
        <div className="modal-body small">
            <h6 className="fw-bold">Features</h6>
            <ul>
                <li><strong>Template</strong> — the payload is built from a template stored in the database. Each create screen lists the templates for its API (Okta or SCIM) and remembers the one you last picked.</li>
                <li><strong>Random Name</strong> — fetches a new person from the name generator and rebuilds the payload. Every token gets a fresh value.</li>
                <li><strong>Prefill from</strong> — uses an existing user's name, email and login instead of a random person. On create, that user's local row is linked to the new account instead of a new row being added.</li>
                <li><strong>Initial status</strong> — Okta: picks the activation query params and adds or removes <code>credentials.password</code>. SCIM: sets <code>active</code> and adds or removes <code>password</code>. Changing the status keeps your manual edits.</li>
                <li><strong>Manage</strong> — add, edit, duplicate or delete templates, with a preview of the rendered payload.</li>
                <li>The payload is plain JSON and can be edited freely before sending. Changing the template, the person or the prefill rebuilds it and discards edits.</li>
            </ul>

            {TEMPLATE_TOKENS.map(g => (
                <div key={g.group} className="mb-3">
                    <h6 className="fw-bold mb-1">{g.group}</h6>
                    <div className="text-muted mb-1">{g.note}</div>
                    <table className="table table-sm table-bordered mb-0">
                        <tbody>
                            {g.tokens.map(t => (
                                <tr key={t.token}><td style={{ width: '35%' }}><code>{t.token}</code></td><td>{t.desc}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}

            <h6 className="fw-bold mb-1">Modifiers</h6>
            <div className="text-muted mb-1">Append to any token with <code>|</code>; they can be chained and run left to right.</div>
            <table className="table table-sm table-bordered">
                <tbody>
                    {TEMPLATE_MODIFIERS.map(m => (
                        <tr key={m.token}><td style={{ width: '20%' }}><code>{m.token}</code></td><td>{m.desc}</td><td><code>{m.example}</code></td></tr>
                    ))}
                </tbody>
            </table>

            <h6 className="fw-bold mb-1">Notes</h6>
            <ul className="mb-0">
                <li>Put tokens inside quoted JSON strings: <code>"userName": "{'{{sam}}'}@corp.example.com"</code>. Values are escaped for JSON.</li>
                <li>An unknown token or modifier is an error, shown above the payload, so typos are caught before sending.</li>
            </ul>
        </div>
        <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
    </Modal>,
    document.body
);
