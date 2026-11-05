// The local users table is the source of truth for a user. Every route that writes a user to Okta or a
// SCIM server saves what that system returned here, through saveUser, and hands back the stored row.
import { db } from '../db.js';

// Attributes kept in users.profile (JSON). The names are Okta's base profile names, which aren't tied to
// either API; fromScim maps SCIM core + enterprise attributes onto the same keys.
export const PROFILE_KEYS = [
  'middleName', 'displayName', 'nickName', 'title', 'userType', 'preferredLanguage',
  'department', 'employeeNumber', 'costCenter', 'organization', 'division',
  'mobilePhone', 'primaryPhone',
  'streetAddress', 'city', 'state', 'zipCode', 'countryCode',
];

const SCIM_ENTERPRISE = 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User';

const now = () => new Date().toISOString();
const blank = (v) => v === undefined || v === null || v === '';
const withoutUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
const withoutBlank = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !blank(v)));
const parseProfile = (text) => { try { return JSON.parse(text) || {}; } catch { return {}; } };

// Row as the API returns it: profile parsed, scim_active as a boolean
export const serializeUser = (row) => row && {
  ...row,
  profile: parseProfile(row.profile),
  scim_active: row.scim_active === null || row.scim_active === undefined ? null : !!row.scim_active,
};

export const getUser = async (where) => serializeUser(await db('users').where(where).first());

// Okta user object → row fields. Okta returns the whole profile, so a key it omits was cleared:
// it is set to null here, which saveUser removes from the stored profile.
export const fromOkta = (user) => {
  const p = user.profile || {};
  return {
    okta_id: user.id,
    status: user.status,
    okta_last_updated: user.lastUpdated,
    okta_synced_at: now(),
    ...withoutBlank({ email: p.email, first_name: p.firstName, last_name: p.lastName, login: p.login }),
    profile: Object.fromEntries(PROFILE_KEYS.map(k => [k, blank(p[k]) ? null : p[k]])),
  };
};

// SCIM User resource → row fields. A SCIM server may not support every attribute, so only the ones
// it returns are set and the rest of the stored profile is kept.
export const fromScim = (user, serverId) => {
  const name = user.name || {};
  const ent = user[SCIM_ENTERPRISE] || {};
  const emails = user.emails || [];
  const phones = user.phoneNumbers || [];
  const addresses = user.addresses || [];
  const addr = addresses.find(a => a.type === 'work') || addresses.find(a => a.primary) || addresses[0] || {};
  return {
    scim_server_id: serverId,
    scim_id: user.id,
    scim_active: typeof user.active === 'boolean' ? user.active : undefined,
    scim_last_modified: user.meta?.lastModified,
    scim_synced_at: now(),
    ...withoutBlank({
      // email is required locally: a SCIM user without one falls back to its userName
      email: (emails.find(e => e.primary) || emails[0])?.value || user.userName,
      first_name: name.givenName,
      last_name: name.familyName,
      login: user.userName,
    }),
    profile: withoutBlank({
      middleName: name.middleName,
      displayName: user.displayName,
      nickName: user.nickName,
      title: user.title,
      userType: user.userType,
      preferredLanguage: user.preferredLanguage,
      mobilePhone: phones.find(p => p.type === 'mobile')?.value,
      primaryPhone: (phones.find(p => p.type === 'work') || phones.find(p => p.primary && p.type !== 'mobile'))?.value,
      streetAddress: addr.streetAddress,
      city: addr.locality,
      state: addr.region,
      zipCode: addr.postalCode,
      countryCode: addr.country,
      employeeNumber: ent.employeeNumber,
      costCenter: ent.costCenter,
      organization: ent.organization,
      division: ent.division,
      department: ent.department,
    }),
  };
};

// Fields that clear a row's SCIM link (the SCIM user was deleted; the local row is kept)
export const SCIM_UNLINK = { scim_server_id: null, scim_id: null, scim_active: null, scim_last_modified: null, scim_synced_at: null };
// Fields that clear a row's Okta link (the Okta user was deleted but the row is still linked to SCIM)
export const OKTA_UNLINK = { okta_id: null, status: null, okta_last_updated: null, okta_synced_at: null };

/**
 * Merges `fields` into the row matching `where` and returns the stored row (serialized).
 * `profile` is merged key by key; a null value removes that key. Undefined fields are ignored.
 * With `insert` (extra columns for a new row, e.g. { source }), a row is created when none matches;
 * otherwise a missing row returns null.
 */
export async function saveUser(where, fields, { insert } = {}) {
  const existing = await db('users').where(where).first();
  if (!existing && !insert) return null;

  const { profile, ...cols } = withoutUndefined(fields);
  const row = { ...cols, updated_at: now() };
  if (profile || !existing) {
    const merged = { ...parseProfile(existing?.profile), ...profile };
    row.profile = JSON.stringify(withoutBlank(merged));
  }

  if (existing) {
    await db('users').where({ id: existing.id }).update(row);
    return getUser({ id: existing.id });
  }
  const [id] = await db('users').insert({ ...insert, ...row });
  return getUser({ id });
}
