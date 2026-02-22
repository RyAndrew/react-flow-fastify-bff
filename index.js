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

// ─── Config ──────────────────────────────────────────────────────────

const config = {
  OKTA_ISSUER: process.env.OKTA_ISSUER,
  OKTA_CLIENT_ID: process.env.OKTA_CLIENT_ID,
  OKTA_CLIENT_SECRET: process.env.OKTA_CLIENT_SECRET,
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  SESSION_SECRET: process.env.SESSION_SECRET,
  PORT: parseInt(process.env.PORT || '3000', 10),
};

const required = ['OKTA_ISSUER', 'OKTA_CLIENT_ID', 'OKTA_CLIENT_SECRET', 'SESSION_SECRET'];
for (const key of required) {
  if (!config[key]) throw new Error(`Missing required env var: ${key}`);
}

// ─── App ─────────────────────────────────────────────────────────────

const fastify = Fastify({ logger: { base: null } });

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

// Serve the SPA
fastify.get('/', (_request, reply) => {
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
