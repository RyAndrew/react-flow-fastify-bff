import { db } from '../db.js';
import { requireSession } from '../lib/auth-guards.js';
import { callScimDownstream } from '../lib/downstream.js';

export default async function scimRoutes(fastify) {
  fastify.addHook('preHandler', requireSession);

  // Resolves the server from X-Scim-Server-Id; sends the error reply and returns null if it can't
  const loadServer = async (request, reply) => {
    const serverId = request.headers['x-scim-server-id'];
    if (!serverId) {
      reply.status(400).send({ error: 'Missing X-Scim-Server-Id header' });
      return null;
    }

    const server = await db('scim_servers').where({ id: serverId }).first();
    if (!server) {
      reply.status(404).send({ error: `SCIM server ${serverId} not found` });
      return null;
    }
    return server;
  };

  const basicAuthFor = (server) => 'Basic ' + Buffer.from(`${server.username}:${server.password}`).toString('base64');

  const proxy = async (request, reply, method, scimPath, body) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;

    const qs = new URLSearchParams(request.query).toString();
    const url = `${server.url}${scimPath}${qs ? '?' + qs : ''}`;

    const { response, data } = await callScimDownstream(request, method, url, body, basicAuthFor(server));
    if (response.status === 204) return reply.status(204).send();
    return reply.status(response.status).send(data);
  };

  // ─── Users ────────────────────────────────────────────────────

  fastify.get('/Users', (req, reply) => proxy(req, reply, 'GET', '/scim/v2/Users', null));
  fastify.get('/Users/:id', (req, reply) => proxy(req, reply, 'GET', `/scim/v2/Users/${req.params.id}`, null));
  fastify.post('/Users', (req, reply) => proxy(req, reply, 'POST', '/scim/v2/Users', req.body));
  fastify.put('/Users/:id', (req, reply) => proxy(req, reply, 'PUT', `/scim/v2/Users/${req.params.id}`, req.body));
  fastify.patch('/Users/:id', (req, reply) => proxy(req, reply, 'PATCH', `/scim/v2/Users/${req.params.id}`, req.body));
  fastify.delete('/Users/:id', (req, reply) => proxy(req, reply, 'DELETE', `/scim/v2/Users/${req.params.id}`, null));

  // POST /Users/:id/import — fetch a SCIM user and add (or refresh) it in the local users table
  // ?localId= — local row (e.g. an Okta user) the SCIM user was created from: link it instead of inserting a new row
  fastify.post('/Users/:id/import', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;

    const url = `${server.url}/scim/v2/Users/${encodeURIComponent(request.params.id)}`;
    const { response, data } = await callScimDownstream(request, 'GET', url, null, basicAuthFor(server));
    if (!response.ok) {
      return reply.status(response.status).send({ error: 'SCIM server error', details: data });
    }

    const profile = {
      email: data.emails?.find(e => e.primary)?.value || data.emails?.[0]?.value || data.userName,
      first_name: data.name?.givenName,
      last_name: data.name?.familyName,
      login: data.userName,
    };

    const { localId } = request.query;
    const linked = localId
      ? await db('users').where({ id: localId }).whereNull('scim_id').update({ scim_server_id: server.id, scim_id: data.id })
      : 0;
    if (linked) return { ok: true, user: await db('users').where({ id: localId }).first() };

    await db('users')
      .insert({ source: 'scim', scim_server_id: server.id, scim_id: data.id, ...profile })
      .onConflict(['scim_server_id', 'scim_id'])
      .merge(Object.keys(profile));

    const user = await db('users').where({ scim_server_id: server.id, scim_id: data.id }).first();
    return { ok: true, user };
  });

  // ─── Groups ───────────────────────────────────────────────────

  fastify.get('/Groups', (req, reply) => proxy(req, reply, 'GET', '/scim/v2/Groups', null));
  fastify.get('/Groups/:id', (req, reply) => proxy(req, reply, 'GET', `/scim/v2/Groups/${req.params.id}`, null));
  fastify.post('/Groups', (req, reply) => proxy(req, reply, 'POST', '/scim/v2/Groups', req.body));
  fastify.put('/Groups/:id', (req, reply) => proxy(req, reply, 'PUT', `/scim/v2/Groups/${req.params.id}`, req.body));
  fastify.patch('/Groups/:id', (req, reply) => proxy(req, reply, 'PATCH', `/scim/v2/Groups/${req.params.id}`, req.body));
  fastify.delete('/Groups/:id', (req, reply) => proxy(req, reply, 'DELETE', `/scim/v2/Groups/${req.params.id}`, null));
}
