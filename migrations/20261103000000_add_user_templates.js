// Payload templates for the create-user screens. `body` is JSON text containing {{tokens}}
// (rendered in the browser, see public/lib/templates.js); `target` is the API it is sent to.

const SCIM_CORE = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCIM_ENTERPRISE = 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User';

const SEED = [
  {
    name: 'Okta — Basic',
    target: 'okta',
    body: {
      profile: {
        firstName: '{{firstName}}',
        middleName: '{{middleName}}',
        lastName: '{{lastName}}',
        email: '{{email}}',
        login: '{{login}}',
      },
    },
  },
  {
    name: 'Okta — Employee profile',
    target: 'okta',
    body: {
      profile: {
        firstName: '{{firstName}}',
        middleName: '{{middleName}}',
        lastName: '{{lastName}}',
        displayName: '{{firstName}} {{lastName}}',
        email: '{{email}}',
        login: '{{login}}',
        title: '{{pick:Systems Engineer,Analyst,Account Manager,Developer}}',
        department: '{{pick:IT,Finance,Sales,HR}}',
        employeeNumber: '{{digits:6}}',
        mobilePhone: '+1 415 555 {{digits:4}}',
        streetAddress: '100 Main St',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94105',
        countryCode: 'US',
      },
    },
  },
  {
    // Shaped like an AD account from New-ADUser: userName = -UserPrincipalName (prefix = sAMAccountName),
    // name/displayName = -GivenName/-Surname/-Name, enterprise extension = -EmployeeNumber/-Department/-Company/-Division
    name: 'SCIM — AD user (New-ADUser)',
    target: 'scim',
    body: {
      schemas: [SCIM_CORE, SCIM_ENTERPRISE],
      userName: '{{sam}}@corp.example.com',
      name: { givenName: '{{firstName}}', middleName: '{{middleName}}', familyName: '{{lastName}}', formatted: '{{firstName}} {{lastName}}' },
      displayName: '{{firstName}} {{lastName}}',
      title: '{{pick:Systems Engineer,Analyst,Account Manager,Developer}}',
      emails: [{ value: '{{sam}}@corp.example.com', type: 'work', primary: true }],
      phoneNumbers: [
        { value: '+1 415 555 {{digits:4}}', type: 'work', primary: true },
        { value: '+1 415 555 {{digits:4}}', type: 'mobile' },
      ],
      addresses: [{ type: 'work', streetAddress: '100 Main St', locality: 'San Francisco', region: 'CA', postalCode: '94105', country: 'US', primary: true }],
      password: '{{password}}',
      active: true,
      [SCIM_ENTERPRISE]: {
        employeeNumber: '{{digits:6}}',
        department: '{{pick:IT,Finance,Sales,HR}}',
        organization: 'Example Corp',
        division: 'Infrastructure',
      },
    },
  },
  {
    name: 'SCIM — Basic',
    target: 'scim',
    body: {
      schemas: [SCIM_CORE],
      userName: '{{login}}',
      name: { givenName: '{{firstName}}', familyName: '{{lastName}}' },
      emails: [{ value: '{{email}}', type: 'work', primary: true }],
      active: true,
    },
  },
];

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('user_templates', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('target').notNullable(); // 'okta' | 'scim'
    table.text('body').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex('user_templates').insert(SEED.map(t => ({ ...t, body: JSON.stringify(t.body, null, 2) })));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('user_templates');
}
