// Two-column key/value table; rows: [[key, value], ...]
const AttributeTable = ({ rows }) => (
    <table className="table table-sm table-striped mb-0">
        <thead className="table-light"><tr><th style={{ width: '35%' }}>Attribute</th><th>Value</th></tr></thead>
        <tbody>
            {rows.map(([key, value]) => (
                <tr key={key}>
                    <td className="small font-monospace">{key}</td>
                    <td className="small" style={{ wordBreak: 'break-all' }}>{value === null || value === undefined || value === '' ? '—' : String(value)}</td>
                </tr>
            ))}
        </tbody>
    </table>
);
