// To allow self-signed certificates on downstream targets, uncomment the import
// and pass `dispatcher: insecureAgent` in each fetch options object below.
import { Agent } from 'undici';
import { redactSecrets } from './redact.js';
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

/**
 * Calls a downstream API using the session's access token.
 * Attaches timing and response info to `request.downstream` so the
 * request logger can persist it as part of the audit record.
 */
export async function callDownstream(request, method, url, body) {
  const { access_token } = request.session.tokens;
  const dsBody = body ? JSON.stringify(body) : undefined;
  const dsStart = process.hrtime.bigint();

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: dsBody,
      //dispatcher: insecureAgent,
    });
  } catch (err) {
    const dsDuration = Number((process.hrtime.bigint() - dsStart) / 1_000_000n);
    request.log.error(
      { err, cause: err.cause, url, method, duration_ms: dsDuration },
      `Downstream fetch failed: ${method} ${url}`
    );
    throw err;
  }

  let data = null;
  const text = await response.text();
  try { data = JSON.parse(text); } catch { data = text || null; }

  const dsDuration = Number((process.hrtime.bigint() - dsStart) / 1_000_000n);

  request.downstream = {
    url,
    method,
    status_code: response.status,
    request_body: body ? JSON.stringify(redactSecrets(body)) : null,
    response_body: typeof data === 'string' ? data : JSON.stringify(data),
    duration_ms: dsDuration,
  };

  return { response, data };
}

/**
 * Calls a downstream SCIM API using HTTP Basic Auth.
 * Attaches timing and response info to `request.downstream` so the
 * request logger can persist it as part of the audit record.
 */
export async function callScimDownstream(request, method, url, body, basicAuthHeader) {
  const dsBody = body ? JSON.stringify(body) : undefined;
  const dsStart = process.hrtime.bigint();

  const headers = {
    'Authorization': basicAuthHeader,
    'Accept': 'application/json', //application/scim+json, 
  };
  if (dsBody) headers['Content-Type'] = 'application/scim+json';

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: dsBody,
      dispatcher: insecureAgent,
    });
  } catch (err) {
    const dsDuration = Number((process.hrtime.bigint() - dsStart) / 1_000_000n);
    request.log.error(
      { err, cause: err.cause, url, method, duration_ms: dsDuration },
      `SCIM downstream fetch failed: ${method} ${url}`
    );
    throw err;
  }

  let data = null;
  const text = await response.text();
  try { data = JSON.parse(text); } catch { data = text || null; }

  const dsDuration = Number((process.hrtime.bigint() - dsStart) / 1_000_000n);

  request.downstream = {
    url,
    method,
    status_code: response.status,
    request_body: body ? JSON.stringify(redactSecrets(body)) : null,
    response_body: typeof data === 'string' ? data : JSON.stringify(data),
    duration_ms: dsDuration,
  };

  const logPayload = { scim: { method, url, status: response.status, duration_ms: dsDuration } };
  if (!response.ok) logPayload.scim.errorBody = data;
  request.log.info(logPayload, `SCIM ${method} ${url} → ${response.status} (${dsDuration}ms)`);

  return { response, data };
}
