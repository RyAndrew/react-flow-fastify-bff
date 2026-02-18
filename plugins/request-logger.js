import fp from 'fastify-plugin';

async function requestLoggerPlugin(fastify, opts) {
  const { db } = opts;

  fastify.addHook('onRequest', async (request) => {
    request.startTime = process.hrtime.bigint();
  });

  fastify.addHook('onError', async (request, reply, error) => {
    request.capturedError = error.message;
  });

  fastify.addHook('onResponse', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;

    const durationMs = request.startTime
      ? Number((process.hrtime.bigint() - request.startTime) / 1_000_000n)
      : null;

    const hasMutatingBody = ['POST', 'PUT', 'PATCH'].includes(request.method);
    let requestBody = null;
    if (hasMutatingBody && request.body) {
      try {
        requestBody = JSON.stringify(request.body);
      } catch {
        requestBody = '[unparseable]';
      }
    }

    const ds = request.downstream || null;

    db('log_access')
      .insert({
        session_id: request.session?.sessionId || null,
        method: request.method,
        url: request.url,
        status_code: reply.statusCode,
        request_body: requestBody,
        error: request.capturedError || null,
        duration_ms: durationMs,
        user_sub: request.session?.user?.sub || null,
        downstream_url: ds?.url || null,
        downstream_method: ds?.method || null,
        downstream_status_code: ds?.status_code || null,
        downstream_request_body: ds?.request_body || null,
        downstream_response_body: ds?.response_body || null,
        downstream_duration_ms: ds?.duration_ms || null,
      })
      .catch((err) => fastify.log.warn(err, 'Failed to persist request log'));
  });
}

export default fp(requestLoggerPlugin, { name: 'request-logger' });
