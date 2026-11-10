// The local users table: one row per identity. The identity attributes (email, first_name, last_name,
// login, profile) belong to the row and are written only when the row is created or through saveIdentity.
// Each system a credential lives in keeps its own copy of what it last returned, in its own JSON column
// (okta_profile, scim_profile), with when the row last saw it (okta_synced_at, scim_synced_at). An Okta or
// SCIM read or write never changes the identity, so drift between the systems stays visible.
import { db } from '../db.js';
import { identityToRow, oktaToIdentity, rowToIdentity, scimToIdentity } from './attribute-map.js';

export { PROFILE_KEYS } from './attribute-map.js';

const now = () => new Date().toISOString();
const withoutUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
const parseJson = (text) => { if (!text) return null; try { return JSON.parse(text); } catch { return null; } };
const JSON_COLUMNS = ['profile', 'okta_profile', 'scim_profile'];

// SQLite CURRENT_TIMESTAMP ('YYYY-MM-DD HH:MM:SS', UTC) and ISO strings → ms, for comparing
const toMs = (v) => (v ? Date.parse(/^\d{4}-\d\d-\d\d \d/.test(v) ? `${v.replace(' ', 'T')}Z` : v) : NaN);
// The identity changed after that system last showed us its copy
const isStale = (identityAt, syncedAt) => toMs(identityAt) > toMs(syncedAt);

// Row as the API returns it: JSON columns parsed, scim_active as a boolean, stale flags per system, and
// the identity plus each system's copy in canonical attribute names (identity / okta_identity /
// scim_identity), so the UI can compare them without its own copy of the mapping
export const serializeUser = (row) => {
  if (!row) return row;
  const profile = parseJson(row.profile) || {};
  const okta_profile = parseJson(row.okta_profile);
  const scim_profile = parseJson(row.scim_profile);
  return {
    ...row,
    profile, okta_profile, scim_profile,
    scim_active: row.scim_active === null || row.scim_active === undefined ? null : !!row.scim_active,
    okta_stale: !!row.okta_id && isStale(row.identity_updated_at, row.okta_synced_at),
    scim_stale: !!row.scim_id && isStale(row.identity_updated_at, row.scim_synced_at),
    identity: rowToIdentity({ ...row, profile }),
    okta_identity: okta_profile ? oktaToIdentity({ profile: okta_profile }) : null,
    scim_identity: scim_profile ? scimToIdentity(scim_profile) : null,
  };
};

export const getUser = async (where) => serializeUser(await db('users').where(where).first());

// Okta user object → the row's Okta columns
export const fromOkta = (user) => ({
  okta_id: user.id,
  status: user.status,
  okta_last_updated: user.lastUpdated,
  okta_synced_at: now(),
  okta_profile: user.profile || {},
});

// SCIM User resource → the row's SCIM columns (meta.location is API navigation, not an attribute)
export const fromScim = (user, serverId) => {
  const { meta, ...rest } = user;
  const { location, ...keptMeta } = meta || {};
  return {
    scim_server_id: serverId,
    scim_id: user.id,
    scim_active: typeof user.active === 'boolean' ? user.active : undefined,
    scim_last_modified: meta?.lastModified,
    scim_synced_at: now(),
    scim_profile: meta ? { ...rest, meta: keptMeta } : rest,
  };
};

// Identity for a row created from what a system returned (import, or an inline create)
export const identityFromOkta = (user) => oktaToIdentity(user);
export const identityFromScim = (user) => scimToIdentity(user);

// Fields that clear a row's link to a system (its user was deleted; the row is kept). The synced time
// records when the row last heard from that system: the delete.
export const scimUnlink = () => ({ scim_server_id: null, scim_id: null, scim_active: null, scim_last_modified: null, scim_profile: null, scim_synced_at: now() });
export const oktaUnlink = () => ({ okta_id: null, status: null, okta_last_updated: null, okta_profile: null, okta_synced_at: now() });

const toDbRow = (fields) => {
  const row = withoutUndefined(fields);
  for (const k of JSON_COLUMNS) if (row[k] && typeof row[k] === 'object') row[k] = JSON.stringify(row[k]);
  return row;
};

/**
 * Merges system `fields` (fromOkta / fromScim / *Unlink output, or status columns) into the row matching
 * `where` and returns the stored row (serialized). Undefined fields are ignored. Identity columns in
 * `fields` are not allowed here; they change only on insert or through saveIdentity.
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
    identity_updated_at: row.okta_synced_at || row.scim_synced_at || row.updated_at,
    ...row,
  });
  return getUser({ id });
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
