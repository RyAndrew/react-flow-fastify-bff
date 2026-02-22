/**
 * Calls a downstream API using the session's access token.
 * Attaches timing and response info to `request.downstream` so the
 * request logger can persist it as part of the audit record.
 */
export async function callDownstream(request, method, url, body) {
  const { access_token } = request.session.tokens;
  const dsBody = body ? JSON.stringify(body) : undefined;
  const dsStart = process.hrtime.bigint();

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: dsBody,
  });

  let data = null;
  const text = await response.text();
  try { data = JSON.parse(text); } catch { data = text || null; }

  const dsDuration = Number((process.hrtime.bigint() - dsStart) / 1_000_000n);

  request.downstream = {
    url,
    method,
    status_code: response.status,
    request_body: dsBody || null,
    response_body: typeof data === 'string' ? data : JSON.stringify(data),
    duration_ms: dsDuration,
  };

  return { response, data };
}
