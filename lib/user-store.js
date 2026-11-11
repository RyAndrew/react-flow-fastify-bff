// The local users table: one row per identity. The identity attributes (email, first_name, last_name,
// login, profile) belong to the row and are written only when the row is created or through saveIdentity.
// Each system a credential lives in keeps its own copy of what it last returned, with when the row last saw
// it: Okta on the users row (okta_profile, okta_synced_at), and each SCIM server in its own scim_accounts
// row (profile, synced_at), at most one per server. An Okta or SCIM read or write never changes the
// identity, so drift between the systems stays visible.
import { db } from '../db.js';
import { identityToRow, oktaToIdentity, rowToIdentity, scimToIdentity } from './attribute-map.js';

export { PROFILE_KEYS } from './attribute-map.js';

const now = () => new Date().toISOString();
const withoutUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
const parseJson = (text) => { if (!text) return null; try { return JSON.parse(text); } catch { return null; } };
const JSON_COLUMNS = ['profile', 'okta_profile'];

// SQLite CURRENT_TIMESTAMP ('YYYY-MM-DD HH:MM:SS', UTC) and ISO strings → ms, for comparing
const toMs = (v) => (v ? Date.parse(/^\d{4}-\d\d-\d\d \d/.test(v) ? `${v.replace(' ', 'T')}Z` : v) : NaN);
// The identity changed after that system last showed us its copy
const isStale = (identityAt, syncedAt) => toMs(identityAt) > toMs(syncedAt);

// scim_accounts row (joined with its server's name) as the API returns it
const serializeAccount = (acc, identityUpdatedAt) => {
  const profile = parseJson(acc.profile);
  return {
    id: acc.id,
    scim_server_id: acc.scim_server_id,
    server_name: acc.server_name ?? null,
    scim_id: acc.scim_id,
    active: acc.active === null || acc.active === undefined ? null : !!acc.active,
    last_modified: acc.last_modified,
    synced_at: acc.synced_at,
    profile,
    identity: profile ? scimToIdentity(profile) : null,
    stale: isStale(identityUpdatedAt, acc.synced_at),
  };
};

// Row as the API returns it: JSON columns parsed, the Okta stale flag, the SCIM accounts (scim_accounts),
// and the identity plus each system's copy in canonical attribute names (identity / okta_identity /
// scim_accounts[].identity), so the UI can compare them without its own copy of the mapping
export const serializeUser = (row, accounts = []) => {
  if (!row) return row;
  const profile = parseJson(row.profile) || {};
  const okta_profile = parseJson(row.okta_profile);
  return {
    ...row,
    profile, okta_profile,
    okta_stale: !!row.okta_id && isStale(row.identity_updated_at, row.okta_synced_at),
    identity: rowToIdentity({ ...row, profile }),
    okta_identity: okta_profile ? oktaToIdentity({ profile: okta_profile }) : null,
    scim_accounts: accounts.map(a => serializeAccount(a, row.identity_updated_at)),
  };
};

// SCIM accounts of these users, grouped by user id, with their server's name
const loadAccounts = async (userIds) => {
  const byUser = new Map();
  if (!userIds.length) return byUser;
  const rows = await db('scim_accounts as a')
    .leftJoin('scim_servers as s', 's.id', 'a.scim_server_id')
    .whereIn('a.user_id', userIds)
    .select('a.*', 's.name as server_name')
    .orderBy('a.id');
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id).push(r);
  }
  return byUser;
};

export const getUser = async (where) => {
  const row = await db('users').where(where).first();
  if (!row) return null;
  return serializeUser(row, (await loadAccounts([row.id])).get(row.id));
};

// Rows from a users query, serialized with their SCIM accounts (one accounts query for the whole list)
export const listUsers = async (query) => {
  const rows = await query;
  const accounts = await loadAccounts(rows.map(r => r.id));
  return rows.map(r => serializeUser(r, accounts.get(r.id)));
};

// Okta user object → the row's Okta columns
export const fromOkta = (user) => ({
  okta_id: user.id,
  status: user.status,
  okta_last_updated: user.lastUpdated,
  okta_synced_at: now(),
  okta_profile: user.profile || {},
});

// SCIM User resource → a scim_accounts row's fields (meta.location is API navigation, not an attribute)
export const fromScim = (user) => {
  const { meta, ...rest } = user;
  const { location, ...keptMeta } = meta || {};
  return {
    scim_id: user.id,
    active: typeof user.active === 'boolean' ? user.active : undefined,
    last_modified: meta?.lastModified,
    synced_at: now(),
    profile: JSON.stringify(meta ? { ...rest, meta: keptMeta } : rest),
  };
};

// Identity for a row created from what a system returned (import, or an inline create)
export const identityFromOkta = (user) => oktaToIdentity(user);
export const identityFromScim = (user) => scimToIdentity(user);

// Fields that clear a row's link to Okta (its user was deleted; the row is kept). The synced time
// records when the row last heard from Okta: the delete.
export const oktaUnlink = () => ({ okta_id: null, status: null, okta_last_updated: null, okta_profile: null, okta_synced_at: now() });

const toDbRow = (fields) => {
  const row = withoutUndefined(fields);
  for (const k of JSON_COLUMNS) if (row[k] && typeof row[k] === 'object') row[k] = JSON.stringify(row[k]);
  return row;
};

/**
 * Merges Okta `fields` (fromOkta / oktaUnlink output, or status columns) into the row matching `where`
 * and returns the stored row (serialized). Undefined fields are ignored. Identity columns in `fields`
 * are not allowed here; they change only on insert or through saveIdentity.
 * With `insert: { source, identity }`, a row is created when none matches, with that identity;
 * otherwise a missing row returns null.
 */
const IDENTITY_COLUMNS = ['email', 'first_name', 'last_name', 'login', 'profile', 'identity_updated_at'];
export async function saveUser(where, fields, { insert } = {}) {
  const bad = Object.keys(fields).filter(k => IDENTITY_COLUMNS.includes(k));
  if (bad.length) throw new Error(`saveUser can't change identity columns (${bad.join(', ')}); use saveIdentity`);

  const existing = await db('users').where(where).first();
  if (!existing && !insert) return null;

  const row = { ...toDbRow(fields), updated_at: now() };
  if (existing) {
    await db('users').where({ id: existing.id }).update(row);
    return getUser({ id: existing.id });
  }
  // A row seeded from a system's response is in sync with it: same time for the identity and that sync
  const { source, identity } = insert;
  const [id] = await db('users').insert({
    source,
    ...toDbRow(identityToRow(identity || {})),
    identity_updated_at: row.okta_synced_at || row.updated_at,
    ...row,
  });
  return getUser({ id });
}

/**
 * Stores a SCIM user just read from or written to server `serverId` and returns the identity it belongs
 * to (serialized), or null:
 *  - an account already linked to (serverId, scimUser.id) is refreshed;
 *  - else with `localId`, it is linked to that identity, if it has no account on this server yet;
 *  - else with `insert: { source, identity }`, a new identity is created for it;
 *  - else nothing is stored.
 */
export async function saveScimAccount(serverId, scimUser, { localId, insert } = {}) {
  const fields = withoutUndefined(fromScim(scimUser));
  const stamp = fields.synced_at;
  const existing = await db('scim_accounts').where({ scim_server_id: serverId, scim_id: scimUser.id }).first();

  let userId = existing?.user_id;
  if (existing) {
    await db('scim_accounts').where({ id: existing.id }).update({ ...fields, updated_at: stamp });
  } else {
    if (localId) {
      const free = await db('users').where({ id: localId })
        .whereNotExists(db('scim_accounts').where({ scim_server_id: serverId }).whereRaw('scim_accounts.user_id = users.id'))
        .first('id');
      userId = free?.id;
    }
    if (!userId && insert) {
      const [id] = await db('users').insert({
        source: insert.source,
        ...toDbRow(identityToRow(insert.identity || {})),
        identity_updated_at: stamp,
        updated_at: stamp,
      });
      userId = id;
    }
    if (!userId) return null;
    await db('scim_accounts').insert({ user_id: userId, scim_server_id: serverId, ...fields, created_at: stamp, updated_at: stamp });
  }
  await db('users').where({ id: userId }).update({ updated_at: stamp });
  return getUser({ id: userId });
}

// The SCIM user (serverId, scimId) was deleted: removes its account and returns the identity it belonged
// to (serialized, kept), or null if it wasn't linked
export async function deleteScimAccount(serverId, scimId) {
  const acc = await db('scim_accounts').where({ scim_server_id: serverId, scim_id: scimId }).first();
  if (!acc) return null;
  await db('scim_accounts').where({ id: acc.id }).del();
  await db('users').where({ id: acc.user_id }).update({ updated_at: now() });
  return getUser({ id: acc.user_id });
}

// Inserts an identity with no credential yet (no row has id -1, so saveUser always inserts)
export const createIdentity = (identity, source = 'identity') => saveUser({ id: -1 }, {}, { insert: { source, identity } });

// Replaces a row's identity attributes (the whole set: a key left out is removed). Returns the row, or null.
export async function saveIdentity(id, identity) {
  const count = await db('users').where({ id }).update({
    ...toDbRow(identityToRow(identity)),
    identity_updated_at: now(),
    updated_at: now(),
  });
  return count ? getUser({ id }) : null;
}
