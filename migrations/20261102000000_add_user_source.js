// Adds import tracking to users and makes okta_id nullable (SCIM imports have no
// Okta ID until they are created in Okta). SQLite can't alter a column's
// nullability, so the table is rebuilt and the rows copied across.

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('users_new', (table) => {
    table.increments('id').primary();
    table.string('okta_id').unique();
    table.string('email').notNullable();
    table.string('first_name');
    table.string('last_name');
    table.string('login');
    table.string('status');
    // 'created' (Create User node), 'okta' (imported from Okta), 'scim' (imported from a SCIM server)
    table.string('source').notNullable().defaultTo('created');
    table.integer('scim_server_id');
    table.string('scim_id');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['scim_server_id', 'scim_id']);
  });

  await knex.raw(`
    INSERT INTO users_new (id, okta_id, email, first_name, last_name, login, status, created_at)
    SELECT id, okta_id, email, first_name, last_name, login, status, created_at FROM users
  `);
  await knex.schema.dropTable('users');
  await knex.schema.renameTable('users_new', 'users');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.createTable('users_old', (table) => {
    table.increments('id').primary();
    table.string('okta_id').notNullable().unique();
    table.string('email').notNullable();
    table.string('first_name');
    table.string('last_name');
    table.string('login');
    table.string('status');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // SCIM imports that were never created in Okta have no okta_id and can't be kept
  await knex.raw(`
    INSERT INTO users_old (id, okta_id, email, first_name, last_name, login, status, created_at)
    SELECT id, okta_id, email, first_name, last_name, login, status, created_at FROM users
    WHERE okta_id IS NOT NULL
  `);
  await knex.schema.dropTable('users');
  await knex.schema.renameTable('users_old', 'users');
}
