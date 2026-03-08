import { db } from '../db.js';
import { requireSession } from '../lib/auth-guards.js';

const SAFE_COLS = ['id', 'name', 'url', 'username', 'created_at'];

export default async function scimServerRoutes(fastify) {
  fastify.addHook('preHandler', requireSession);

  // GET / — list all servers (no passwords)
  fastify.get('/', async () => {
    const servers = await db('scim_servers').select(...SAFE_COLS).orderBy('id');
    return { servers };
  });

  // POST / — create a server
  fastify.post('/', async (request, reply) => {
    const { name, url, username, password } = request.body || {};
    if (!name || !url || !username || !password) {
      return reply.status(400).send({ error: 'name, url, username, password are required' });
    }
    const [id] = await db('scim_servers').insert({ name, url, username, password });
    const server = await db('scim_servers').where({ id }).select(...SAFE_COLS).first();
    return reply.status(201).send({ server });
  });

  // PUT /:id — update a server (password only updated if provided)
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, url, username, password } = request.body || {};
    if (!name || !url || !username) {
      return reply.status(400).send({ error: 'name, url, username are required' });
    }
    const updates = { name, url, username };
    if (password) updates.password = password;
    const count = await db('scim_servers').where({ id }).update(updates);
    if (!count) return reply.status(404).send({ error: 'Server not found' });
    const server = await db('scim_servers').where({ id }).select(...SAFE_COLS).first();
    return { server };
  });

  // DELETE /:id — delete a server
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params;
    const count = await db('scim_servers').where({ id }).del();
    if (!count) return reply.status(404).send({ error: 'Server not found' });
    return { ok: true };
  });
}
