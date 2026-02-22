import { db } from '../db.js';
import { requireAccessToken } from '../lib/auth-guards.js';
import { callDownstream } from '../lib/downstream.js';

export default async function userRoutes(fastify) {
  const downstreamApiUrl = 'http://127.0.0.1:3000';

  fastify.addHook('preHandler', requireAccessToken);

  // GET / — list users from local DB
  fastify.get('/', async () => {
    const users = await db('users').select('*').orderBy('created_at', 'desc');
    return { users };
  });

  // POST /create — create user via downstream API + store locally
  fastify.post('/create', async (request, reply) => {
    const body = request.body;
    if (!body?.profile?.email) {
      return reply.status(400).send({ error: 'Missing required user profile (email, firstName, lastName)' });
    }

    const url = `${downstreamApiUrl}/api/v1/users?activate=true`;
    const { response, data } = await callDownstream(request, 'POST', url, body);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Create user failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    // Persist to local users table
    await db('users').insert({
      okta_id: data.id,
      email: data.profile?.email,
      first_name: data.profile?.firstName,
      last_name: data.profile?.lastName,
      login: data.profile?.login,
      status: data.status,
    });

    return { ok: true, user: data };
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

    // Sync local record
    await db('users').where({ okta_id: oktaId }).update({
      email: data.profile?.email,
      first_name: data.profile?.firstName,
      last_name: data.profile?.lastName,
      login: data.profile?.login,
      status: data.status,
    });

    return { ok: true, user: data };
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
  fastify.post('/:oktaId/lifecycle/:action', async (request, reply) => {
    const { oktaId, action } = request.params;

    const url = `${downstreamApiUrl}/api/v1/users/${oktaId}/lifecycle/${action}`;
    const { response, data } = await callDownstream(request, 'POST', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, `Lifecycle ${action} failed`);
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    // Refresh user status from downstream
    const statusUrl = `${downstreamApiUrl}/api/v1/users/${oktaId}`;
    const { data: refreshed } = await callDownstream(request, 'GET', statusUrl, null);
    if (refreshed?.status) {
      await db('users').where({ okta_id: oktaId }).update({ status: refreshed.status });
    }

    return { ok: true, action, user: refreshed || data };
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

    await db('users').where({ okta_id: oktaId }).update({ status: 'DEPROVISIONED' });
    return { ok: true, action: 'deactivate', user: data };
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

    await db('users').where({ okta_id: oktaId }).del();
    return { ok: true, action: 'delete' };
  });
}
