// Help for identity templates and the create screens: features, identity attributes, every token and
// modifier. Rendered in a portal because it opens on top of other modals.
const TemplateTokenHelp = ({ onClose }) => {
    const [attributes, setAttributes] = React.useState([]);
    React.useEffect(() => { loadIdentityAttributes().then(setAttributes); }, []);

    return ReactDOM.createPortal(
        <Modal show={true} onClose={onClose} title="Identity Templates & Tokens" size="modal-lg">
            <div className="modal-body small">
                <h6 className="fw-bold">How it fits together</h6>
                <ul>
                    <li><strong>Identity</strong>: who the person is, stored in the local database. A template renders one from a random person; the result can be edited before saving.</li>
                    <li><strong>Credential</strong>: an account for an identity in one system (an Okta user, or an AD user over SCIM). Its payload is built from the identity by a fixed mapping in the BFF, so Okta and AD get the same values. The payload can still be edited before sending.</li>
                    <li><strong>Initial status</strong> belongs to the credential. For Okta, it picks the activation query params and adds or removes <code>credentials.password</code>. For SCIM, it sets <code>active</code> and adds or removes <code>password</code>. Changing the status keeps your manual edits.</li>
                    <li><strong>Random Name</strong> fetches a new person and re-renders the template. Every token gets a fresh value, and manual edits are discarded.</li>
                    <li><strong>Manage</strong> lets you add, edit, duplicate or delete templates. Its preview shows the identity and the Okta and SCIM payloads built from it. The template you pick is remembered.</li>
                </ul>

                <h6 className="fw-bold mb-1">Identity attributes (template keys)</h6>
                <div className="text-muted mb-1">A template body is a flat JSON object using these keys. Any other key is an error. Values a token leaves empty are dropped.</div>
                <p className="mb-3">{attributes.map(a => <code key={a} className="me-2 d-inline-block">{a}</code>)}</p>

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
                    <li>Put tokens inside quoted JSON strings, for example <code>"email": "{'{{sam}}'}@corp.example.com"</code>. Values are escaped for JSON.</li>
                    <li>An unknown token, modifier or attribute is an error, shown above the identity, so typos are caught before saving.</li>
                    <li>Passwords are not identity attributes. The initial status adds one to the credential payload when it needs one.</li>
                </ul>
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </Modal>,
        document.body
    );
};
