import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { db } from './db.js';
import sessionPlugin from './plugins/session.js';
import oidcPlugin from './plugins/oidc.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';

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

const fastify = Fastify({ logger: true });

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

// OIDC client (Okta discovery)
await fastify.register(oidcPlugin, {
  issuer: config.OKTA_ISSUER,
  clientId: config.OKTA_CLIENT_ID,
  clientSecret: config.OKTA_CLIENT_SECRET,
  appUrl: config.APP_URL,
});

// API routes
await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
await fastify.register(userRoutes, { prefix: '/api/v1/users' });

// SPA fallback
fastify.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith('/api/')) {
    return reply.status(404).send({ error: 'Not found' });
  }
  return reply.sendFile('index.html');
});

// ─── Start ───────────────────────────────────────────────────────────

try {
  await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
