import fp from 'fastify-plugin';

function calculateDurationMs(startTime) {
  if (!startTime) return null;
  return Number((process.hrtime.bigint() - startTime) / 1_000_000n);
}

function buildLogRecord(request, reply, durationMs) {
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

  return {
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
  };
}

async function requestLoggerPlugin(fastify, opts) {
  const { db } = opts;

  fastify.addHook('onRequest', async (request) => {
    request.startTime = process.hrtime.bigint();
  });

  fastify.addHook('preHandler', async (request) => {
    request.log.info({ req: {method: request.method, url:request.url, host:request.host, remoteAddress:request.remoteAddress, }, sessionId: request.session?.sessionId, user: (request.session?.user?.name || request.session?.user?.email|| '') });
  });

  fastify.addHook('onError', async (request, _reply, error) => {
    request.capturedError = error.message;
  });

  fastify.addHook('onResponse', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;

    const durationMs = calculateDurationMs(request.startTime);
    const record = buildLogRecord(request, reply, durationMs);

    db('log_access')
      .insert(record)
      .catch((err) => fastify.log.warn(err, 'Failed to persist request log'));
  });
}

export default fp(requestLoggerPlugin, { name: 'request-logger' });
