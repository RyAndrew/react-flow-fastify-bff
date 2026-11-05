import { db } from '../db.js';
import { requireSession } from '../lib/auth-guards.js';
import { callScimDownstream } from '../lib/downstream.js';
import { fromScim, saveUser, SCIM_UNLINK } from '../lib/user-store.js';

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

  // query: forwarded to the SCIM server as-is (filter, startIndex, count, attributes, ...)
  const forward = (request, server, method, scimPath, body, query = request.query) => {
    const qs = new URLSearchParams(query).toString();
    const url = `${server.url}${scimPath}${qs ? '?' + qs : ''}`;
    return callScimDownstream(request, method, url, body, basicAuthFor(server));
  };

  const send = (reply, response, data) => (response.status === 204 ? reply.status(204).send() : reply.status(response.status).send(data));

  const proxy = async (request, reply, method, scimPath, body) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;
    const { response, data } = await forward(request, server, method, scimPath, body);
    return send(reply, response, data);
  };

  // Writes to a SCIM user also update the local row linked to it. The SCIM response is passed through
  // unchanged; the local row's id goes in X-Local-User-Id so the client can re-read it from the DB.
  const sendWithLocal = (reply, response, data, localUser) => {
    if (localUser) reply.header('X-Local-User-Id', String(localUser.id));
    return send(reply, response, data);
  };

  // A PATCH may answer 204 with no body: re-read the user so the row gets its values and meta.lastModified.
  // The PATCH stays as the audit-logged downstream call.
  const readBack = async (request, server, id) => {
    const writeDownstream = request.downstream;
    const { response, data } = await forward(request, server, 'GET', `/scim/v2/Users/${encodeURIComponent(id)}`, null, {});
    request.downstream = writeDownstream;
    return response.ok ? data : null;
  };

  // ─── Users ────────────────────────────────────────────────────

  fastify.get('/Users', (req, reply) => proxy(req, reply, 'GET', '/scim/v2/Users', null));
  fastify.get('/Users/:id', (req, reply) => proxy(req, reply, 'GET', `/scim/v2/Users/${req.params.id}`, null));

  // POST /Users — create; ?localId= links the new SCIM user to that local row (e.g. the Okta user it was
  // built from), else it is saved as a new row with source 'scim'
  fastify.post('/Users', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;
    const { localId, ...query } = request.query;
    const { response, data } = await forward(request, server, 'POST', '/scim/v2/Users', request.body, query);
    if (!response.ok || !data?.id) return send(reply, response, data);

    const fields = fromScim(data, server.id);
    const localUser = (localId && await saveUser({ id: localId, scim_id: null }, fields))
      || await saveUser({ scim_server_id: server.id, scim_id: data.id }, fields, { insert: { source: 'scim' } });
    return sendWithLocal(reply, response, data, localUser);
  });

  fastify.put('/Users/:id', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;
    const { id } = request.params;
    const { response, data } = await forward(request, server, 'PUT', `/scim/v2/Users/${id}`, request.body);
    if (!response.ok) return send(reply, response, data);
    const user = data?.id ? data : await readBack(request, server, id);
    const localUser = user && await saveUser({ scim_server_id: server.id, scim_id: id }, fromScim(user, server.id));
    return sendWithLocal(reply, response, data, localUser);
  });

  fastify.patch('/Users/:id', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;
    const { id } = request.params;
    const { response, data } = await forward(request, server, 'PATCH', `/scim/v2/Users/${id}`, request.body);
    if (!response.ok) return send(reply, response, data);
    const user = data?.id ? data : await readBack(request, server, id);
    const localUser = user && await saveUser({ scim_server_id: server.id, scim_id: id }, fromScim(user, server.id));
    return sendWithLocal(reply, response, data, localUser);
  });

  // DELETE /Users/:id — the local row is kept, with its SCIM link cleared
  fastify.delete('/Users/:id', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;
    const { id } = request.params;
    const { response, data } = await forward(request, server, 'DELETE', `/scim/v2/Users/${id}`, null);
    const gone = response.ok || response.status === 404;
    const localUser = gone ? await saveUser({ scim_server_id: server.id, scim_id: id }, SCIM_UNLINK) : null;
    return sendWithLocal(reply, response, data, localUser);
  });

  // POST /Users/:id/import — fetch a SCIM user and add (or refresh) it in the local users table
  // ?localId= — local row (e.g. an Okta user) the SCIM user was created from: link it instead of inserting a new row
  fastify.post('/Users/:id/import', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;

    const { response, data } = await forward(request, server, 'GET', `/scim/v2/Users/${encodeURIComponent(request.params.id)}`, null, {});
    if (!response.ok) {
      return reply.status(response.status).send({ error: 'SCIM server error', details: data });
    }

    const fields = fromScim(data, server.id);
    const { localId } = request.query;
    const user = (localId && await saveUser({ id: localId, scim_id: null }, fields))
      || await saveUser({ scim_server_id: server.id, scim_id: data.id }, fields, { insert: { source: 'scim' } });
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
