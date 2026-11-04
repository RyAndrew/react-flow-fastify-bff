import { db } from '../db.js';
import { requireSession } from '../lib/auth-guards.js';

const TARGETS = ['okta', 'scim'];

// Body is checked only for being non-empty: it holds {{tokens}}, so it is not valid JSON until rendered
const validate = ({ name, target, body } = {}) => {
  if (!name?.trim() || !body?.trim()) return 'name and body are required';
  if (!TARGETS.includes(target)) return `target must be one of: ${TARGETS.join(', ')}`;
  return null;
};

export default async function templateRoutes(fastify) {
  fastify.addHook('preHandler', requireSession);

  // GET / — list templates; ?target=okta|scim narrows to one API
  fastify.get('/', async (request) => {
    const { target } = request.query;
    let query = db('user_templates').select('*').orderBy('id');
    if (target) query = query.where({ target });
    const templates = await query;
    return { templates };
  });

  // POST / — create a template
  fastify.post('/', async (request, reply) => {
    const error = validate(request.body);
    if (error) return reply.status(400).send({ error });
    const { name, target, body } = request.body;
    const [id] = await db('user_templates').insert({ name: name.trim(), target, body });
    const template = await db('user_templates').where({ id }).first();
    return reply.status(201).send({ template });
  });

  // PUT /:id — update a template
  fastify.put('/:id', async (request, reply) => {
    const error = validate(request.body);
    if (error) return reply.status(400).send({ error });
    const { id } = request.params;
    const { name, target, body } = request.body;
    const count = await db('user_templates').where({ id }).update({ name: name.trim(), target, body, updated_at: db.fn.now() });
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
