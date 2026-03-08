import { db } from '../db.js';
import { requireSession } from '../lib/auth-guards.js';
import { callScimDownstream } from '../lib/downstream.js';

export default async function scimRoutes(fastify) {
  fastify.addHook('preHandler', requireSession);

  const proxy = async (request, reply, method, scimPath, body) => {
    const serverId = request.headers['x-scim-server-id'];
    if (!serverId) {
      return reply.status(400).send({ error: 'Missing X-Scim-Server-Id header' });
    }

    const server = await db('scim_servers').where({ id: serverId }).first();
    if (!server) {
      return reply.status(404).send({ error: `SCIM server ${serverId} not found` });
    }

    const basicAuth = 'Basic ' + Buffer.from(`${server.username}:${server.password}`).toString('base64');
    const qs = new URLSearchParams(request.query).toString();
    const url = `${server.url}${scimPath}${qs ? '?' + qs : ''}`;

    const { response, data } = await callScimDownstream(request, method, url, body, basicAuth);
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

  // ─── Groups ───────────────────────────────────────────────────

  fastify.get('/Groups', (req, reply) => proxy(req, reply, 'GET', '/scim/v2/Groups', null));
  fastify.get('/Groups/:id', (req, reply) => proxy(req, reply, 'GET', `/scim/v2/Groups/${req.params.id}`, null));
  fastify.post('/Groups', (req, reply) => proxy(req, reply, 'POST', '/scim/v2/Groups', req.body));
  fastify.put('/Groups/:id', (req, reply) => proxy(req, reply, 'PUT', `/scim/v2/Groups/${req.params.id}`, req.body));
  fastify.patch('/Groups/:id', (req, reply) => proxy(req, reply, 'PATCH', `/scim/v2/Groups/${req.params.id}`, req.body));
  fastify.delete('/Groups/:id', (req, reply) => proxy(req, reply, 'DELETE', `/scim/v2/Groups/${req.params.id}`, null));
}
