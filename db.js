import knex from 'knex';

export const db = knex({
  client: 'better-sqlite3',
  connection: { filename: './app.db' },
  useNullAsDefault: true,
  migrations: { directory: './migrations' },
});
