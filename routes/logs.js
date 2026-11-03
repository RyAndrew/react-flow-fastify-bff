import { db } from '../db.js';
import { requireSession, requireAccessToken } from '../lib/auth-guards.js';
import { callDownstream } from '../lib/downstream.js';

// created_at is SQLite CURRENT_TIMESTAMP text ('YYYY-MM-DD HH:MM:SS', UTC); compare in the same format
const toSqliteTimestamp = (value) => {
  const d = new Date(value);
  return isNaN(d) ? null : d.toISOString().replace('T', ' ').slice(0, 19);
};

const STATUS_RANGES = { '2xx': [200, 299], '3xx': [300, 399], '4xx': [400, 499], '5xx': [500, 599], error: [400, 599] };

const TEXT_COLUMNS = ['url', 'request_body', 'error', 'downstream_url', 'downstream_request_body', 'downstream_response_body'];

export default async function logRoutes(fastify) {
  const downstreamApiUrl = 'http://127.0.0.1:3000';

  fastify.addHook('preHandler', requireSession);

  // GET / — return recent request logs (newest first)
  // ?scope=scim — only SCIM client requests (/api/v1/scim/...)
  // ?url_contains=comma,separated,patterns — filter to logs whose URL matches any pattern
  // ?method= &status=2xx|3xx|4xx|5xx|error &q=text (URL, bodies, error) &since= &until= (ISO)
  // ?exclude_self=1 — hide the log viewer's own requests
  // ?limit= &before_id= — page backwards; the response's `next` is the before_id for the next page
  fastify.get('/', async (request) => {
    const { scope, url_contains, method, status, q, since, until, exclude_self, before_id } = request.query;
    const limit = Math.min(parseInt(request.query.limit) || 50, 200);
    let query = db('log_access').select('*');

    if (scope === 'scim') query = query.where('url', 'like', '/api/v1/scim/%');
    if (exclude_self) query = query.whereNot('url', 'like', '/api/v1/logs%');

    if (url_contains) {
      const patterns = url_contains.split(',').map(p => p.trim()).filter(Boolean);
      if (patterns.length) {
        query = query.where(function () {
          for (const p of patterns) {
            this.orWhere('url', 'like', `%${p}%`);
          }
        });
      }
    }

    if (method) query = query.where('method', method.toUpperCase());
    if (STATUS_RANGES[status]) query = query.whereBetween('status_code', STATUS_RANGES[status]);

    if (q) {
      query = query.where(function () {
        for (const col of TEXT_COLUMNS) this.orWhere(col, 'like', `%${q}%`);
      });
    }

    const sinceTs = since && toSqliteTimestamp(since);
    const untilTs = until && toSqliteTimestamp(until);
    if (sinceTs) query = query.where('created_at', '>=', sinceTs);
    if (untilTs) query = query.where('created_at', '<=', untilTs);
    if (before_id) query = query.where('id', '<', parseInt(before_id));

    const logs = await query.orderBy('id', 'desc').limit(limit);
    const next = logs.length === limit ? logs[logs.length - 1].id : null;
    return { logs, next };
  });

  // GET /okta — query the Okta System Log (newest first)
  // ?filter= (SCIM-style expression) &q= (keywords) &since= &until= (ISO) &limit= &after= (cursor from `next`)
  fastify.get('/okta', { preHandler: requireAccessToken }, async (request, reply) => {
    const { filter, q, since, until, after } = request.query;
    const limit = Math.min(parseInt(request.query.limit) || 50, 1000);

    const qs = new URLSearchParams({ limit: String(limit), sortOrder: 'DESCENDING' });
    if (filter) qs.set('filter', filter);
    if (q) qs.set('q', q);
    if (since) qs.set('since', since);
    if (until) qs.set('until', until);
    if (after) qs.set('after', after);

    const url = `${downstreamApiUrl}/api/v1/logs?${qs}`;
    const { response, data } = await callDownstream(request, 'GET', url, null);

    if (!response.ok) {
      fastify.log.error({ status: response.status, data }, 'Okta System Log query failed');
      return reply.status(response.status).send({ error: 'Downstream API error', details: data });
    }

    // Don't copy whole pages of System Log events into our own access log
    if (Array.isArray(data)) request.downstream.response_body = `[${data.length} System Log events omitted]`;

    // Okta paginates with a Link header: <...?after=cursor>; rel="next"
    const nextLink = (response.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/)?.[1];
    const next = nextLink ? new URL(nextLink).searchParams.get('after') : null;

    return { ok: true, logs: data, next };
  });
}
