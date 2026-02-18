/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('sessions', (table) => {
    table.string('sid').primary();
    table.text('sess').notNullable();
    table.bigInteger('expired_at').notNullable();
  });

  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('okta_id').notNullable().unique();
    table.string('email').notNullable();
    table.string('first_name');
    table.string('last_name');
    table.string('login');
    table.string('status');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('log_access', (table) => {
    table.increments('id').primary();
    table.string('session_id');
    table.string('method', 10).notNullable();
    table.string('url', 2048).notNullable();
    table.integer('status_code');
    table.text('request_body');
    table.text('error');
    table.integer('duration_ms');
    table.string('user_sub');
    table.string('downstream_url', 2048);
    table.string('downstream_method', 10);
    table.integer('downstream_status_code');
    table.text('downstream_request_body');
    table.text('downstream_response_body');
    table.integer('downstream_duration_ms');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('log_access');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('sessions');
}
