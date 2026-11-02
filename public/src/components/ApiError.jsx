// Error display. `data` is either a plain message (client-side errors like 'Invalid JSON')
// or a BFF error response: { error, details: { errorSummary, errorCauses, errorCode, errorId } }
// (Okta) or { error, details: { detail, scimType, status } } (SCIM).
// `compact` drops the code/ID line for use inside table cells.
const ApiError = ({ data, compact }) => {
    if (typeof data === 'string') return <p className="text-danger small mb-1">&#10007; {data}</p>;

    const details = data?.details && typeof data.details === 'object' ? data.details : null;
    const summary = details?.errorSummary || details?.detail || data?.error || 'Unknown error';
    const causes = details?.errorCauses || [];

    return (
        <div className={compact ? 'small text-start' : ''}>
            <p className="text-danger fw-bold mb-1">&#10007; {summary}</p>
            {causes.length > 0 && (
                <ul className="text-danger small mb-2">
                    {causes.map((c, i) => <li key={i}>{c.errorSummary || fmtJson(c)}</li>)}
                </ul>
            )}
            {!compact && (details?.errorCode || details?.errorId) && (
                <p className="small text-muted mb-2">
                    {details.errorCode && <>Code: <code>{details.errorCode}</code> </>}
                    {details.errorId && <>&middot; Error ID: <code>{details.errorId}</code></>}
                </p>
            )}
            <details className="mb-1">
                <summary className="small text-muted">Full response</summary>
                <pre className="json-pre text-danger mt-1">{fmtJson(data)}</pre>
            </details>
        </div>
    );
};
