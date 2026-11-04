import 'dotenv/config';
import path from 'path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { db } from './db.js';
import sessionPlugin from './plugins/session.js';
import oidcPlugin from './plugins/oidc.js';
import requestLoggerPlugin from './plugins/request-logger.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import logRoutes from './routes/logs.js';
import scimRoutes from './routes/scim.js';
import scimServerRoutes from './routes/scim-servers.js';
import nameRoutes from './routes/names.js';
import templateRoutes from './routes/templates.js';

// ─── Config ──────────────────────────────────────────────────────────

const config = {
  OKTA_ISSUER: process.env.OKTA_ISSUER,
  OKTA_CLIENT_ID: process.env.OKTA_CLIENT_ID,
  OKTA_CLIENT_SECRET: process.env.OKTA_CLIENT_SECRET,
  APP_URL: process.env.APP_URL || 'http://localhost:3301',
  SESSION_SECRET: process.env.SESSION_SECRET,
  PORT: process.env.PORT || '3301',
};

const required = ['OKTA_ISSUER', 'OKTA_CLIENT_ID', 'OKTA_CLIENT_SECRET', 'SESSION_SECRET'];
for (const key of required) {
  if (!config[key]) throw new Error(`Missing required env var: ${key}`);
}

// ─── App ─────────────────────────────────────────────────────────────
console.log('starting fastify server')
const fastify = Fastify({
  logger: { base:null },
  disableRequestLogging:true,
  trustProxy: true,
});
fastify.decorate('appConfig', config);

// Run migrations on startup
await db.migrate.latest();
fastify.log.info('Database migrations applied');

// Static files from public/
await fastify.register(fastifyStatic, {
  root: path.resolve('public'),
});

// Session (HttpOnly cookie + SQLite-backed store)
await fastify.register(sessionPlugin, {
  secret: config.SESSION_SECRET,
  db,
  //secure: true,
  secure: config.APP_URL.startsWith('https'),
});

// Request logger (persists every API request as one row in SQLite)
await fastify.register(requestLoggerPlugin, { db });

// OIDC client (Okta discovery)
await fastify.register(oidcPlugin, {
  issuer: config.OKTA_ISSUER,
  clientId: config.OKTA_CLIENT_ID,
  clientSecret: config.OKTA_CLIENT_SECRET,
  appUrl: config.APP_URL,
});

// API routes
await fastify.register(authRoutes, { prefix: '/auth' });
await fastify.register(userRoutes, { prefix: '/api/v1/users' });
await fastify.register(logRoutes, { prefix: '/api/v1/logs' });
await fastify.register(scimRoutes, { prefix: '/api/v1/scim' });
await fastify.register(scimServerRoutes, { prefix: '/api/v1/scim-servers' });
await fastify.register(nameRoutes, { prefix: '/api/v1/names' });
await fastify.register(templateRoutes, { prefix: '/api/v1/templates' });

// Serve the SPA
fastify.get('/', (_request, reply) => {

  console.log(_request.raw.headers);

  reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  reply.header('Pragma', 'no-cache');
  reply.header('Expires', '0');
  return reply.sendFile('index.html');
});

// ─── Start ───────────────────────────────────────────────────────────

try {
  await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
