// Identities: the local users rows as people, apart from any credential (Okta user, SCIM/AD account).
// Nothing here calls Okta or a SCIM server; the credential routes (users.js, scim.js) do that.
import { db } from '../db.js';
import { requireSession } from '../lib/auth-guards.js';
import { IDENTITY_KEYS, PAYLOAD_BUILDERS, cleanIdentity, rowToIdentity } from '../lib/attribute-map.js';
import { createIdentity, getUser, saveIdentity } from '../lib/user-store.js';

// Returns an error message, or null. Unknown keys are rejected so a typo doesn't silently drop an attribute.
const validate = (identity) => {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) return 'Body must be an identity object';
  const unknown = Object.keys(identity).filter(k => !IDENTITY_KEYS.includes(k));
  if (unknown.length) return `Unknown identity attributes: ${unknown.join(', ')}`;
  if (!cleanIdentity(identity).email) return 'email is required';
  return null;
};

export default async function identityRoutes(fastify) {
  fastify.addHook('preHandler', requireSession);

  // GET /attributes — the identity attribute names (template keys)
  fastify.get('/attributes', async () => ({ attributes: IDENTITY_KEYS }));

  // POST / — create an identity with no credential; body: identity
  fastify.post('/', async (request, reply) => {
    const error = validate(request.body);
    if (error) return reply.status(400).send({ error });
    const user = await createIdentity(request.body);
    return reply.status(201).send({ ok: true, user });
  });

  // PUT /:id — replace an identity's attributes; body: identity. Okta/SCIM copies are left as they are
  // (and show as stale until the next sync).
  fastify.put('/:id', async (request, reply) => {
    const error = validate(request.body);
    if (error) return reply.status(400).send({ error });
    const user = await saveIdentity(request.params.id, request.body);
    if (!user) return reply.status(404).send({ error: `Identity ${request.params.id} not found` });
    return { ok: true, user };
  });

  // DELETE /:id — delete an identity that has no credential left
  fastify.delete('/:id', async (request, reply) => {
    const row = await db('users').where({ id: request.params.id }).first();
    if (!row) return reply.status(404).send({ error: `Identity ${request.params.id} not found` });
    if (row.okta_id || row.scim_id) {
      return reply.status(409).send({ error: 'Identity still has a credential: delete its Okta user and SCIM user first' });
    }
    await db('users').where({ id: row.id }).del();
    return { ok: true, localUserId: row.id };
  });

  // POST /payload/:target — create payload for an identity in one system (okta | scim)
  // body: { identity } (e.g. one not saved yet) or { id } (a local row)
  fastify.post('/payload/:target', async (request, reply) => {
    const build = PAYLOAD_BUILDERS[request.params.target];
    if (!build) return reply.status(400).send({ error: `target must be one of: ${Object.keys(PAYLOAD_BUILDERS).join(', ')}` });

    const { id, identity } = request.body || {};
    let source = identity;
    if (id !== undefined && id !== null && id !== '') {
      const row = await getUser({ id });
      if (!row) return reply.status(404).send({ error: `Identity ${id} not found` });
      source = rowToIdentity(row);
    } else {
      const error = validate(identity);
      if (error) return reply.status(400).send({ error });
    }
    return { ok: true, payload: build(source) };
  });
}
