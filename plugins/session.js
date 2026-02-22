import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import { KnexSessionStore } from './session-store.js';

async function sessionPlugin(fastify, opts) {
  await fastify.register(cookie);

  await fastify.register(session, {
    secret: opts.secret,
    store: new KnexSessionStore(opts.db),
    cookieName: 'sid',
    cookie: {
      httpOnly: true,
      secure: opts.secure,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    saveUninitialized: false,
  });
}

export default fp(sessionPlugin, { name: 'session' });
