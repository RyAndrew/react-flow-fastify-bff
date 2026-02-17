import fp from 'fastify-plugin';
import * as oidcClient from 'openid-client';

async function oidcPlugin(fastify, opts) {
  const config = await oidcClient.discovery(
    new URL(opts.issuer),
    opts.clientId,
    opts.clientSecret
  );

  fastify.decorate('oidc', { config, client: oidcClient });
}

export default fp(oidcPlugin, { name: 'oidc' });
