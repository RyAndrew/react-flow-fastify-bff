import { db } from '../db.js';

export default async function logRoutes(fastify) {
  // Auth guard
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session?.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
  });

  // GET / — return recent request logs
  // ?url_contains=comma,separated,patterns — filter to logs whose URL matches any pattern
  fastify.get('/', async (request) => {
    const limit = Math.min(parseInt(request.query.limit) || 50, 200);
    let query = db('log_access').select('*');

    if (request.query.url_contains) {
      const patterns = request.query.url_contains.split(',').map(p => p.trim()).filter(Boolean);
      if (patterns.length) {
        query = query.where(function () {
          for (const p of patterns) {
            this.orWhere('url', 'like', `%${p}%`);
          }
        });
      }
    }

    const logs = await query.orderBy('created_at', 'desc').limit(limit);
    return { logs };
  });
}
