export default async function userRoutes(fastify) {
  const { appConfig } = fastify;

  // Derive Okta org URL from issuer (strip /oauth2/... path)
  const issuerUrl = new URL(appConfig.OKTA_ISSUER);
  const downstreamApiUrl = 'http://127.0.0.1:3000';

  // Auth guard — ensure session has tokens
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.session?.tokens?.access_token) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
  });

  // POST /create — proxy to Okta Users API
  fastify.post('/create', async (request, reply) => {
    const { access_token } = request.session.tokens;
    const body = request.body;

    if (!body || !body.profile || !body.profile.email) {
      return reply.status(400).send({ error: 'Missing required user profile (email, firstName, lastName)' });
    }
let url = `${downstreamApiUrl}/api/v1/users?activate=true`
console.log('calling url ',url)
console.log(`Bearer ${access_token}`)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Okta create user failed');
      return reply.status(response.status).send({
        error: 'Okta API error',
        details: data,
      });
    }

    return {
      ok: true,
      user: {
        id: data.id,
        status: data.status,
        profile: data.profile,
        created: data.created,
      },
    };
  });
}
