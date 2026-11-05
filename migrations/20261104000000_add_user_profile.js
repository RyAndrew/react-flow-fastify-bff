// Makes the users row the full record of a user: every profile attribute (JSON), the SCIM active flag,
// and the last-changed timestamps each system reported (Okta lastUpdated, SCIM meta.lastModified) with
// when the row last took values from it.
//
// Also changes the seeded AD template to map the local user's attributes instead of generating random
// ones, with userName = {{login}} (the UPN shared with Okta). Only changed if it was never edited.

const SCIM_CORE = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCIM_ENTERPRISE = 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User';

const AD_TEMPLATE = 'SCIM — AD user (New-ADUser)';

// Same shape as an AD account from New-ADUser: userName = -UserPrincipalName (its prefix becomes the
// sAMAccountName), name/displayName = -GivenName/-Surname/-Name, enterprise extension =
// -EmployeeNumber/-Department/-Company/-Division. Values come from the local user; empty ones are dropped.
const AD_TEMPLATE_BODY = {
  schemas: [SCIM_CORE, SCIM_ENTERPRISE],
  userName: '{{login}}',
  name: { givenName: '{{firstName}}', middleName: '{{middleName}}', familyName: '{{lastName}}', formatted: '{{firstName}} {{lastName}}' },
  displayName: '{{displayName}}',
  title: '{{title}}',
  emails: [{ value: '{{email}}', type: 'work', primary: true }],
  phoneNumbers: [
    { value: '{{primaryPhone}}', type: 'work', primary: true },
    { value: '{{mobilePhone}}', type: 'mobile' },
  ],
  addresses: [{ type: 'work', streetAddress: '{{streetAddress}}', locality: '{{city}}', region: '{{state}}', postalCode: '{{zipCode}}', country: '{{countryCode}}', primary: true }],
  password: '{{password}}',
  active: true,
  [SCIM_ENTERPRISE]: {
    employeeNumber: '{{employeeNumber}}',
    department: '{{department}}',
    organization: '{{organization}}',
    division: '{{division}}',
    costCenter: '{{costCenter}}',
  },
};

// SQLite drops a column by rebuilding the table, which knex can't do inside the migration's transaction
export const config = { transaction: false };

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.text('profile');                  // JSON object, keys from PROFILE_KEYS in lib/user-store.js
    table.boolean('scim_active');
    table.string('okta_last_updated');      // Okta user lastUpdated
    table.string('okta_synced_at');         // when the row last took values from Okta
    table.string('scim_last_modified');     // SCIM meta.lastModified
    table.string('scim_synced_at');         // when the row last took values from the SCIM server
    table.string('updated_at');
  });

  await knex('user_templates')
    .where({ name: AD_TEMPLATE })
    .whereRaw('updated_at = created_at')
    .update({ body: JSON.stringify(AD_TEMPLATE_BODY, null, 2) });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('profile');
    table.dropColumn('scim_active');
    table.dropColumn('okta_last_updated');
    table.dropColumn('okta_synced_at');
    table.dropColumn('scim_last_modified');
    table.dropColumn('scim_synced_at');
    table.dropColumn('updated_at');
  });
}
