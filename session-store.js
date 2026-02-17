/**
 * Custom session store backed by Knex/SQLite.
 * Implements the express-session store interface required by @fastify/session.
 */
export class KnexSessionStore {
  constructor(db) {
    this.db = db;
  }

  get(sid, callback) {
    this.db('sessions')
      .where({ sid })
      .first()
      .then((row) => {
        if (!row) return callback(null, null);
        if (row.expired_at < Date.now()) {
          this.destroy(sid, () => {});
          return callback(null, null);
        }
        callback(null, JSON.parse(row.sess));
      })
      .catch(callback);
  }

  set(sid, session, callback) {
    const maxAge = session?.cookie?.maxAge || 86400000;
    const data = {
      sid,
      sess: JSON.stringify(session),
      expired_at: Date.now() + maxAge,
    };

    this.db('sessions')
      .insert(data)
      .onConflict('sid')
      .merge()
      .then(() => callback(null))
      .catch(callback);
  }

  destroy(sid, callback) {
    this.db('sessions')
      .where({ sid })
      .del()
      .then(() => callback(null))
      .catch(callback);
  }
}
