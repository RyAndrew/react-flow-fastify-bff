// Okta System Log events (LogEvent objects from /api/v1/logs); click a row for the full event
const OktaLogTable = ({ logs }) => {
    const [expanded, setExpanded] = React.useState(null);

    const outcomeClass = (result) => result === 'SUCCESS' ? 'success' : result === 'FAILURE' || result === 'DENY' ? 'danger' : 'secondary';

    return (
        <div>
            <table className="table table-sm table-striped log-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Event Type</th>
                        <th>Message</th>
                        <th>Outcome</th>
                        <th>Actor</th>
                        <th>Target</th>
                        <th>IP</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map(ev => (
                        <React.Fragment key={ev.uuid}>
                            <tr onClick={() => setExpanded(expanded === ev.uuid ? null : ev.uuid)} style={{ cursor: 'pointer' }}>
                                <td title={ev.published}>{new Date(ev.published).toLocaleString()}</td>
                                <td title={ev.eventType}><code>{ev.eventType}</code></td>
                                <td title={ev.displayMessage}>{ev.displayMessage}</td>
                                <td>
                                    <span className={`badge bg-${outcomeClass(ev.outcome?.result)}`}>{ev.outcome?.result || '—'}</span>
                                    {ev.outcome?.reason && <span className="text-muted ms-1" title={ev.outcome.reason}>{ev.outcome.reason}</span>}
                                </td>
                                <td title={ev.actor?.alternateId}>{ev.actor?.displayName || ev.actor?.alternateId || '—'}</td>
                                <td title={(ev.target || []).map(t => t.alternateId).join(', ')}>
                                    {(ev.target || []).map(t => t.displayName || t.alternateId).join(', ') || '—'}
                                </td>
                                <td>{ev.client?.ipAddress || '—'}</td>
                                <td>{expanded === ev.uuid ? '▲' : '▼'}</td>
                            </tr>
                            {expanded === ev.uuid && (
                                <tr>
                                    <td colSpan={8}>
                                        <pre className="json-pre m-2" style={{ maxHeight: '400px' }}>{fmtJson(ev)}</pre>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
