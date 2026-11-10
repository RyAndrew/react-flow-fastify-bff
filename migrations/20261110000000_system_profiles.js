// Separates a user's identity from what each system holds for it. The users row's own attributes
// (email, names, login, profile) are the identity; Okta's and the SCIM server's copies go in their own
// JSON columns, written by every read or write of that system together with its *_synced_at time.
// identity_updated_at records when the identity last changed, so a system synced before it is stale.
//
// users.source values: 'identity' (Create Identity), 'created' (Create Credential with a new identity),
// 'okta' (imported from Okta), 'scim' (imported from / created on a SCIM server).

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.text('okta_profile');           // Okta user `profile`, as last returned
    table.text('scim_profile');           // SCIM User resource, as last returned (without meta.location)
    table.string('identity_updated_at');  // when the identity attributes last changed
  });
  // Existing rows count as in sync: their identity dates from when they were created
  await knex.raw('UPDATE users SET identity_updated_at = created_at');
}

// SQLite drops a column by rebuilding the table, which knex can't do inside the migration's transaction
export const config = { transaction: false };

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('okta_profile');
    table.dropColumn('scim_profile');
    table.dropColumn('identity_updated_at');
  });
}
