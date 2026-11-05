import { db } from '../db.js';
import { requireAccessToken } from '../lib/auth-guards.js';
import { callDownstream } from '../lib/downstream.js';
import { fromOkta, getUser, saveUser, serializeUser, OKTA_UNLINK } from '../lib/user-store.js';

export default async function userRoutes(fastify) {
  const downstreamApiUrl = 'http://127.0.0.1:3000';

  fastify.addHook('preHandler', requireAccessToken);

  // Re-reads the Okta user after an action whose response isn't the user (lifecycle, deactivate) and saves
  // it locally. The action stays as the audit-logged downstream call. Returns the Okta user, or null.
  const refreshFromOkta = async (request, oktaId) => {
    const actionDownstream = request.downstream;
    const { response, data } = await callDownstream(request, 'GET', `${downstreamApiUrl}/api/v1/users/${encodeURIComponent(oktaId)}`, null);
    request.downstream = actionDownstream;
    if (!response.ok || !data?.id) return null;
    await saveUser({ okta_id: oktaId }, fromOkta(data));
    return data;
  };

  // GET / — list users from local DB
  // Default: only users linked to Okta (have an okta_id).
  // ?source=created|okta|scim — filter by how the user got into the DB
  // ?scope=all — every row, including SCIM imports not yet created in Okta
  fastify.get('/', async (request) => {
    const { source, scope } = request.query;
    let query = db('users').select('*').orderBy('created_at', 'desc');
    if (source) query = query.where({ source });
    else if (scope !== 'all') query = query.whereNotNull('okta_id');
    const users = await query;
    return { users: users.map(serializeUser) };
  });

  // GET /okta/search — search Okta users
  // ?mode=q|filter|search|lookup &value= &limit= &after=
  //   q      — prefix match on firstName, lastName, email
  //   filter — filter expression on a limited set of properties
  //   search — search expression on any profile attribute
  //   lookup — single user by Okta ID or login
  fastify.get('/okta/search', async (request, reply) => {
    const { mode = 'q', value = '', limit = '20', after } = request.query;
    if (!['q', 'filter', 'search', 'lookup'].includes(mode)) {
      return reply.status(400).send({ error: `Unknown search mode: ${mode}` });
    }

    if (mode === 'lookup') {
      if (!value) return reply.status(400).send({ error: 'Lookup requires an Okta ID or login' });
      const url = `${downstreamApiUrl}/api/v1/users/${encodeURIComponent(value)}`;
      const { response, data } = await callDownstream(request, 'GET', url, null);
      if (response.status === 404) return { ok: true, users: [], nextAfter: null };
      if (!response.ok) {
        fastify.log.error({ status: response.status, data }, 'Okta user lookup failed');
        return reply.status(response.status).send({ error: 'Downstream API error', details: data });
      }
      return { ok: true, users: [data], nextAfter: null };
    }

    const qs = new URLSearchParams({ limit });
    if (value) qs.set(mode, value);
    if (after) qs.set('after', after);
    const url = `${downstreamApiUrl}/api/v1/users?${qs}`;
    const { response, data } = await callDownstream(request, 'GET', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Okta user search failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    // Okta paginates with a Link header: <...?after=cursor>; rel="next"
    const next = (response.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/)?.[1];
    const nextAfter = next ? new URL(next).searchParams.get('after') : null;

    return { ok: true, users: data, nextAfter };
  });

  // POST /create — create user via downstream API + store locally
  // ?importedId= — local row of a SCIM import to link to the new Okta user instead of inserting a new row
  // ?activate= / ?nextLogin= — passed through to Okta to pick the initial status (STAGED, PROVISIONED, ACTIVE, PASSWORD_EXPIRED)
  fastify.post('/create', async (request, reply) => {
    const body = request.body;
    if (!body?.profile?.email) {
      return reply.status(400).send({ error: 'Missing required user profile (email, firstName, lastName)' });
    }

    const { importedId, activate = 'true', nextLogin } = request.query;
    const qs = new URLSearchParams({ activate: activate === 'false' ? 'false' : 'true' });
    if (nextLogin === 'changePassword') qs.set('nextLogin', nextLogin);
    const url = `${downstreamApiUrl}/api/v1/users?${qs}`;
    const { response, data } = await callDownstream(request, 'POST', url, body);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Create user failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    // Save the whole Okta profile locally: a SCIM import it was created from, else a new row
    const fields = fromOkta(data);
    const localUser = (importedId && await saveUser({ id: importedId, okta_id: null }, fields))
      || await saveUser({ okta_id: data.id }, fields, { insert: { source: 'created' } });
    return { ok: true, user: data, localUser };
  });

  // GET /local/:id — one row from the local users table
  fastify.get('/local/:id', async (request, reply) => {
    const user = await getUser({ id: request.params.id });
    if (!user) return reply.status(404).send({ error: `Local user ${request.params.id} not found` });
    return { ok: true, user };
  });

  // GET /:oktaId — full user object from Okta
  fastify.get('/:oktaId', async (request, reply) => {
    const { oktaId } = request.params;
    const url = `${downstreamApiUrl}/api/v1/users/${encodeURIComponent(oktaId)}`;
    const { response, data } = await callDownstream(request, 'GET', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Get user failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    return { ok: true, user: data };
  });

  // POST /:oktaId/import — fetch an Okta user and add (or refresh) it in the local DB
  fastify.post('/:oktaId/import', async (request, reply) => {
    const { oktaId } = request.params;

    const url = `${downstreamApiUrl}/api/v1/users/${encodeURIComponent(oktaId)}`;
    const { response, data } = await callDownstream(request, 'GET', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Import user failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    const user = await saveUser({ okta_id: data.id }, fromOkta(data), { insert: { source: 'okta' } });
    return { ok: true, user };
  });

  // POST /:oktaId/update — update user profile via downstream API
  fastify.post('/:oktaId/update', async (request, reply) => {
    const { oktaId } = request.params;
    const body = request.body;

    const url = `${downstreamApiUrl}/api/v1/users/${oktaId}`;
    const { response, data } = await callDownstream(request, 'POST', url, body);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Update user failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    // Okta returns the updated user (profile and credential updates alike)
    const localUser = await saveUser({ okta_id: oktaId }, fromOkta(data));
    return { ok: true, user: data, localUser };
  });

  // GET /groups/search?q= — search groups by name
  fastify.get('/groups/search', async (request, reply) => {
    const q = request.query.q || '';
    const url = `${downstreamApiUrl}/api/v1/groups?q=${encodeURIComponent(q)}&limit=20`;
    const { response, data } = await callDownstream(request, 'GET', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Search groups failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    return { ok: true, groups: data };
  });

  // PUT /:oktaId/groups/:groupId — add user to a group
  fastify.put('/:oktaId/groups/:groupId', async (request, reply) => {
    const { oktaId, groupId } = request.params;
    const url = `${downstreamApiUrl}/api/v1/groups/${groupId}/users/${oktaId}`;
    const { response, data } = await callDownstream(request, 'PUT', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Add user to group failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    return { ok: true };
  });

  // GET /:oktaId/factors/catalog — list enrollable factors
  fastify.get('/:oktaId/factors/catalog', async (request, reply) => {
    const { oktaId } = request.params;

    const url = `${downstreamApiUrl}/api/v1/users/${oktaId}/factors/catalog`;
    const { response, data } = await callDownstream(request, 'GET', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Fetch factors catalog failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    return { ok: true, factors: data };
  });

  // POST /:oktaId/factors — enroll an authenticator/factor
  fastify.post('/:oktaId/factors', async (request, reply) => {
    const { oktaId } = request.params;
    const body = request.body;

    const url = `${downstreamApiUrl}/api/v1/users/${oktaId}/factors`;
    const { response, data } = await callDownstream(request, 'POST', url, body);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Enroll factor failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    return { ok: true, factor: data };
  });

  // POST /:oktaId/lifecycle/:action — lifecycle transitions
  // ?sendEmail=false — for activate / reactivate / reset_password: Okta skips its email and instead
  //   returns the link in the response (activationUrl + activationToken, or resetPasswordUrl)
  fastify.post('/:oktaId/lifecycle/:action', async (request, reply) => {
    const { oktaId, action } = request.params;
    const { sendEmail } = request.query;

    const qs = new URLSearchParams();
    if (sendEmail === 'true' || sendEmail === 'false') qs.set('sendEmail', sendEmail);
    const url = `${downstreamApiUrl}/api/v1/users/${oktaId}/lifecycle/${action}${qs.toString() ? `?${qs}` : ''}`;
    const { response, data } = await callDownstream(request, 'POST', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, `Lifecycle ${action} failed`);
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    const refreshed = await refreshFromOkta(request, oktaId);
    const localUser = await getUser({ okta_id: oktaId });

    // `result` is Okta's raw lifecycle response — may carry activationUrl/activationToken/resetPasswordUrl
    const result = data && typeof data === 'object' && Object.keys(data).length ? data : null;
    return { ok: true, action, user: refreshed || data, result, localUser };
  });

  // POST /:oktaId/deactivate — deactivate user
  fastify.post('/:oktaId/deactivate', async (request, reply) => {
    const { oktaId } = request.params;

    const url = `${downstreamApiUrl}/api/v1/users/${oktaId}/lifecycle/deactivate`;
    const { response, data } = await callDownstream(request, 'POST', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Deactivate user failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    const refreshed = await refreshFromOkta(request, oktaId);
    if (!refreshed) await saveUser({ okta_id: oktaId }, { status: 'DEPROVISIONED' });
    const localUser = await getUser({ okta_id: oktaId });
    return { ok: true, action: 'deactivate', user: refreshed || data, localUser };
  });

  // DELETE /:oktaId — delete user (must be deactivated first)
  fastify.delete('/:oktaId', async (request, reply) => {
    const { oktaId } = request.params;

    const url = `${downstreamApiUrl}/api/v1/users/${oktaId}`;
    const { response, data } = await callDownstream(request, 'DELETE', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Delete user failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    // A row still linked to a SCIM user outlives the Okta user: unlink it instead of deleting it
    const row = await db('users').where({ okta_id: oktaId }).first();
    let localUser = null;
    if (row?.scim_id) localUser = await saveUser({ id: row.id }, OKTA_UNLINK);
    else if (row) await db('users').where({ id: row.id }).del();
    return { ok: true, action: 'delete', localUser, localUserId: row?.id ?? null };
  });
}
