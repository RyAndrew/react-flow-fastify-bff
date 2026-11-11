// Moves the SCIM link out of users into scim_accounts: an identity can hold an account on several SCIM
// servers (AD and other downstream systems), at most one per server. Each account keeps what its server
// last returned (profile, active, meta.lastModified) and when the row last saw it (synced_at).
// Okta stays one-to-one on the users row.

const LINK_COLUMNS = ['scim_server_id', 'scim_id', 'scim_active', 'scim_last_modified', 'scim_synced_at', 'scim_profile'];
// Created by 20261102000000_add_user_source on users_new, which was then renamed to users
const LINK_INDEX = 'users_new_scim_server_id_scim_id_unique';

// SQLite drops a column by rebuilding the table, which knex can't do inside the migration's transaction
export const config = { transaction: false };

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('scim_accounts', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users');
    table.integer('scim_server_id').notNullable().references('id').inTable('scim_servers');
    table.string('scim_id').notNullable();
    table.boolean('active');            // SCIM active, as last returned
    table.string('last_modified');      // SCIM meta.lastModified
    table.string('synced_at');          // when the row last took values from the SCIM server
    table.text('profile');              // SCIM User resource, as last returned (without meta.location)
    table.string('created_at');
    table.string('updated_at');
    table.unique(['scim_server_id', 'scim_id']);
    table.unique(['user_id', 'scim_server_id']);
    table.index('user_id');
  });

  await knex.raw(`
    INSERT INTO scim_accounts (user_id, scim_server_id, scim_id, active, last_modified, synced_at, profile, created_at, updated_at)
    SELECT id, scim_server_id, scim_id, scim_active, scim_last_modified, scim_synced_at, scim_profile,
           COALESCE(scim_synced_at, updated_at, created_at), COALESCE(scim_synced_at, updated_at, created_at)
    FROM users
    WHERE scim_id IS NOT NULL AND scim_server_id IS NOT NULL
  `);

  await knex.raw(`DROP INDEX IF EXISTS \`${LINK_INDEX}\``);
  await knex.schema.alterTable('users', (table) => {
    for (const c of LINK_COLUMNS) table.dropColumn(c);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.integer('scim_server_id');
    table.string('scim_id');
    table.boolean('scim_active');
    table.string('scim_last_modified');
    table.string('scim_synced_at');
    table.text('scim_profile');
  });

  // users holds one link: keep each identity's first account
  await knex.raw(`
    UPDATE users SET
      scim_server_id = a.scim_server_id, scim_id = a.scim_id, scim_active = a.active,
      scim_last_modified = a.last_modified, scim_synced_at = a.synced_at, scim_profile = a.profile
    FROM (SELECT * FROM scim_accounts WHERE id IN (SELECT MIN(id) FROM scim_accounts GROUP BY user_id)) AS a
    WHERE a.user_id = users.id
  `);
  await knex.raw(`CREATE UNIQUE INDEX \`${LINK_INDEX}\` ON users (scim_server_id, scim_id)`);
  await knex.schema.dropTableIfExists('scim_accounts');
}
