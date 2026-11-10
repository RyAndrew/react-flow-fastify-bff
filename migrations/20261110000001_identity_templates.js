// Templates now build an identity, not a payload for one API: `body` is a flat JSON object of identity
// attributes (canonical names, see IDENTITY_KEYS in lib/attribute-map.js) whose values may hold {{tokens}}.
// The BFF maps an identity to the Okta or SCIM payload, so one template serves every system and the
// `target` column goes. The old per-API templates are dropped and the table is reseeded.

const SEED = [
  {
    name: 'Basic',
    body: {
      firstName: '{{firstName}}',
      middleName: '{{middleName}}',
      lastName: '{{lastName}}',
      email: '{{email}}',
      login: '{{login}}',
    },
  },
  {
    // Everything AD's New-ADUser takes over SCIM: UPN = login (its prefix becomes the sAMAccountName),
    // mail = the UPN, enterprise extension = employeeNumber / department / organization / division / costCenter
    name: 'Employee (AD-ready)',
    body: {
      firstName: '{{firstName}}',
      middleName: '{{middleName}}',
      lastName: '{{lastName}}',
      displayName: '{{firstName}} {{lastName}}',
      email: '{{login}}',
      login: '{{login}}',
      title: '{{pick:Systems Engineer,Analyst,Account Manager,Developer}}',
      department: '{{pick:IT,Finance,Sales,HR}}',
      employeeNumber: '{{digits:6}}',
      costCenter: 'CC-{{digits:4}}',
      organization: 'Example Corp',
      division: 'Infrastructure',
      primaryPhone: '+1 415 555 {{digits:4}}',
      mobilePhone: '+1 415 555 {{digits:4}}',
      streetAddress: '100 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      countryCode: 'US',
    },
  },
];

const createTable = (knex, withTarget) => knex.schema.createTable('user_templates', (table) => {
  table.increments('id').primary();
  table.string('name').notNullable();
  if (withTarget) table.string('target').notNullable();
  table.text('body').notNullable();
  table.timestamp('created_at').defaultTo(knex.fn.now());
  table.timestamp('updated_at').defaultTo(knex.fn.now());
});

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.dropTableIfExists('user_templates');
  await createTable(knex, false);
  await knex('user_templates').insert(SEED.map(t => ({ name: t.name, body: JSON.stringify(t.body, null, 2) })));
}

/**
 * Restores the old table shape, empty (the per-API templates aren't recreated).
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('user_templates');
  await createTable(knex, true);
}
