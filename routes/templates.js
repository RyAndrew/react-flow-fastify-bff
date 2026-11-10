import { db } from '../db.js';
import { requireSession } from '../lib/auth-guards.js';

// Identity templates (see migrations/20261110000001_identity_templates.js). Body is checked only for being
// non-empty: it holds {{tokens}}, so it is not valid JSON until rendered in the browser.
const validate = ({ name, body } = {}) => {
  if (!name?.trim() || !body?.trim()) return 'name and body are required';
  return null;
};

export default async function templateRoutes(fastify) {
  fastify.addHook('preHandler', requireSession);

  // GET / — list templates
  fastify.get('/', async () => {
    const templates = await db('user_templates').select('*').orderBy('id');
    return { templates };
  });

  // POST / — create a template
  fastify.post('/', async (request, reply) => {
    const error = validate(request.body);
    if (error) return reply.status(400).send({ error });
    const { name, body } = request.body;
    const [id] = await db('user_templates').insert({ name: name.trim(), body });
    const template = await db('user_templates').where({ id }).first();
    return reply.status(201).send({ template });
  });

  // PUT /:id — update a template
  fastify.put('/:id', async (request, reply) => {
    const error = validate(request.body);
    if (error) return reply.status(400).send({ error });
    const { id } = request.params;
    const { name, body } = request.body;
    const count = await db('user_templates').where({ id }).update({ name: name.trim(), body, updated_at: db.fn.now() });
    if (!count) return reply.status(404).send({ error: 'Template not found' });
    const template = await db('user_templates').where({ id }).first();
    return { template };
  });

  // DELETE /:id — delete a template
  fastify.delete('/:id', async (request, reply) => {
    const count = await db('user_templates').where({ id: request.params.id }).del();
    if (!count) return reply.status(404).send({ error: 'Template not found' });
    return { ok: true };
  });
}
