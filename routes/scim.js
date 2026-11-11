import { db } from '../db.js';
import { requireSession } from '../lib/auth-guards.js';
import { callScimDownstream } from '../lib/downstream.js';
import { deleteScimAccount, identityFromScim, saveScimAccount } from '../lib/user-store.js';

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

  // SCIM users just read on this server: refresh the accounts already linked to them.
  // Never inserts: a SCIM user becomes a local account only through Create or Import. Returns the
  // identity when exactly one user was read and it is linked.
  const syncLinked = async (server, users) => {
    const list = users.filter(u => u?.id);
    if (!list.length) return null;
    const linked = new Set(await db('scim_accounts').where({ scim_server_id: server.id }).whereIn('scim_id', list.map(u => u.id)).pluck('scim_id'));
    let row = null;
    for (const u of list) {
      if (linked.has(u.id)) row = await saveScimAccount(server.id, u);
    }
    return list.length === 1 ? row : null;
  };

  // ─── Users ────────────────────────────────────────────────────

  fastify.get('/Users', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;
    const { response, data } = await forward(request, server, 'GET', '/scim/v2/Users', null);
    if (response.ok && Array.isArray(data?.Resources)) await syncLinked(server, data.Resources);
    return send(reply, response, data);
  });

  fastify.get('/Users/:id', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;
    const { response, data } = await forward(request, server, 'GET', `/scim/v2/Users/${request.params.id}`, null);
    const localUser = response.ok && data?.id ? await syncLinked(server, [data]) : null;
    return sendWithLocal(reply, response, data, localUser);
  });

  // POST /Users — create a SCIM credential; ?localId= is the local identity it belongs to (if it has no
  // account on this server yet), whose attributes are kept. Without it, a new identity (source 'scim')
  // takes its attributes from the response.
  fastify.post('/Users', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;
    const { localId, ...query } = request.query;
    const { response, data } = await forward(request, server, 'POST', '/scim/v2/Users', request.body, query);
    if (!response.ok || !data?.id) return send(reply, response, data);

    const localUser = await saveScimAccount(server.id, data, { localId, insert: { source: 'scim', identity: identityFromScim(data) } });
    return sendWithLocal(reply, response, data, localUser);
  });

  fastify.put('/Users/:id', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;
    const { id } = request.params;
    const { response, data } = await forward(request, server, 'PUT', `/scim/v2/Users/${id}`, request.body);
    if (!response.ok) return send(reply, response, data);
    const user = data?.id ? data : await readBack(request, server, id);
    const localUser = user && await saveScimAccount(server.id, user);
    return sendWithLocal(reply, response, data, localUser);
  });

  fastify.patch('/Users/:id', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;
    const { id } = request.params;
    const { response, data } = await forward(request, server, 'PATCH', `/scim/v2/Users/${id}`, request.body);
    if (!response.ok) return send(reply, response, data);
    const user = data?.id ? data : await readBack(request, server, id);
    const localUser = user && await saveScimAccount(server.id, user);
    return sendWithLocal(reply, response, data, localUser);
  });

  // DELETE /Users/:id — the local identity is kept; its account on this server is removed
  fastify.delete('/Users/:id', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;
    const { id } = request.params;
    const { response, data } = await forward(request, server, 'DELETE', `/scim/v2/Users/${id}`, null);
    const gone = response.ok || response.status === 404;
    const localUser = gone ? await deleteScimAccount(server.id, id) : null;
    return sendWithLocal(reply, response, data, localUser);
  });

  // POST /Users/:id/import — fetch a SCIM user and add it as a local identity (or refresh its account)
  // ?localId= — local identity the SCIM user belongs to: link it instead of inserting a new identity
  fastify.post('/Users/:id/import', async (request, reply) => {
    const server = await loadServer(request, reply);
    if (!server) return reply;

    const { response, data } = await forward(request, server, 'GET', `/scim/v2/Users/${encodeURIComponent(request.params.id)}`, null, {});
    if (!response.ok) {
      return reply.status(response.status).send({ error: 'SCIM server error', details: data });
    }

    const { localId } = request.query;
    const user = await saveScimAccount(server.id, data, { localId, insert: { source: 'scim', identity: identityFromScim(data) } });
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
