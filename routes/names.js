import { requireAccessToken } from '../lib/auth-guards.js';
import { callDownstream } from '../lib/downstream.js';

export default async function nameRoutes(fastify) {
  const downstreamApiUrl = 'http://127.0.0.1:3000';

  fastify.addHook('preHandler', requireAccessToken);

  // GET /random — random person name from downstream API
  // Returns { firstName, middleName, lastName, gender }
  fastify.get('/random', async (request, reply) => {
    const url = `${downstreamApiUrl}/api/v1/names/random`;
    const { response, data } = await callDownstream(request, 'GET', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Random name failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    return data;
  });
}
