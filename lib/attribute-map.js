// The one mapping between an identity (the local users row, in canonical attribute names) and the
// payloads of each system a credential lives in. Every direction goes through ATTRIBUTE_MAP:
//   toOkta / toScim               identity → create payload (what Create Credential / SCIM Create send)
//   oktaToIdentity / scimToIdentity  external user → identity (seeds a row on import or inline create)
// Credential-only fields (password, active, Okta's activate/nextLogin) are not identity attributes:
// they are added by the initial-status step in the browser (applyUserStatus in public/lib/templates.js).

export const SCIM_CORE = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_ENTERPRISE = 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User';

// Identity attributes stored in users.profile (JSON). Names are Okta's base profile names.
export const PROFILE_KEYS = [
  'middleName', 'displayName', 'nickName', 'title', 'userType', 'preferredLanguage',
  'department', 'employeeNumber', 'costCenter', 'organization', 'division',
  'mobilePhone', 'primaryPhone',
  'streetAddress', 'city', 'state', 'zipCode', 'countryCode',
];
// Identity attributes stored in their own users columns
export const CORE_KEYS = ['firstName', 'lastName', 'email', 'login'];
export const IDENTITY_KEYS = [...CORE_KEYS, ...PROFILE_KEYS];

// canonical key → { okta, scim }
//   okta: the Okta profile attribute name. Every Okta attribute lives under `profile`, so names are bare.
//   scim: path segments into the SCIM resource. A { type } segment selects the element of a multi-valued
//         attribute (emails, phoneNumbers, addresses) with that type.
const WORK = { type: 'work' };
const MOBILE = { type: 'mobile' };
export const ATTRIBUTE_MAP = {
  firstName:         { okta: 'firstName',         scim: ['name', 'givenName'] },
  middleName:        { okta: 'middleName',        scim: ['name', 'middleName'] },
  lastName:          { okta: 'lastName',          scim: ['name', 'familyName'] },
  email:             { okta: 'email',             scim: ['emails', WORK, 'value'] },
  login:             { okta: 'login',             scim: ['userName'] },
  displayName:       { okta: 'displayName',       scim: ['displayName'] },
  nickName:          { okta: 'nickName',          scim: ['nickName'] },
  title:             { okta: 'title',             scim: ['title'] },
  userType:          { okta: 'userType',          scim: ['userType'] },
  preferredLanguage: { okta: 'preferredLanguage', scim: ['preferredLanguage'] },
  primaryPhone:      { okta: 'primaryPhone',      scim: ['phoneNumbers', WORK, 'value'] },
  mobilePhone:       { okta: 'mobilePhone',       scim: ['phoneNumbers', MOBILE, 'value'] },
  streetAddress:     { okta: 'streetAddress',     scim: ['addresses', WORK, 'streetAddress'] },
  city:              { okta: 'city',              scim: ['addresses', WORK, 'locality'] },
  state:             { okta: 'state',             scim: ['addresses', WORK, 'region'] },
  zipCode:           { okta: 'zipCode',           scim: ['addresses', WORK, 'postalCode'] },
  countryCode:       { okta: 'countryCode',       scim: ['addresses', WORK, 'country'] },
  employeeNumber:    { okta: 'employeeNumber',    scim: [SCIM_ENTERPRISE, 'employeeNumber'] },
  costCenter:        { okta: 'costCenter',        scim: [SCIM_ENTERPRISE, 'costCenter'] },
  organization:      { okta: 'organization',      scim: [SCIM_ENTERPRISE, 'organization'] },
  division:          { okta: 'division',          scim: [SCIM_ENTERPRISE, 'division'] },
  department:        { okta: 'department',        scim: [SCIM_ENTERPRISE, 'department'] },
};

const blank = (v) => v === undefined || v === null || v === '';
const isSelector = (seg) => seg && typeof seg === 'object';

// Keeps only identity keys with a value, as strings
export const cleanIdentity = (identity = {}) => Object.fromEntries(
  IDENTITY_KEYS.filter(k => !blank(identity[k])).map(k => [k, String(identity[k])]),
);

// ─── Writing (identity → payload) ─────────────────────────────────────

// Sets a value at SCIM path segments, creating objects and multi-valued elements as needed.
// A new work element is the primary one (AD maps the primary email/phone/address).
const setScimPath = (obj, segs, value) => {
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    const next = segs[i + 1];
    if (isSelector(next)) {
      cur[seg] ||= [];
      let el = cur[seg].find(e => e.type === next.type);
      if (!el) { el = { type: next.type, ...(next.type === 'work' ? { primary: true } : {}) }; cur[seg].push(el); }
      cur = el;
      i++; // the selector is consumed
    } else {
      cur[seg] ||= {};
      cur = cur[seg];
    }
  }
  cur[segs[segs.length - 1]] = value;
};

// Okta's login must be email-shaped: a login that isn't (e.g. a bare sAMAccountName) falls back to the email
export const toOkta = (identity) => {
  const id = cleanIdentity(identity);
  const profile = {};
  for (const [key, { okta }] of Object.entries(ATTRIBUTE_MAP)) if (id[key] !== undefined) profile[okta] = id[key];
  if (!profile.login?.includes('@') && profile.email) profile.login = profile.email;
  return { profile };
};

export const toScim = (identity) => {
  const id = cleanIdentity(identity);
  const resource = { schemas: [SCIM_CORE] };
  for (const [key, { scim }] of Object.entries(ATTRIBUTE_MAP)) if (id[key] !== undefined) setScimPath(resource, scim, id[key]);
  const formatted = [id.firstName, id.lastName].filter(Boolean).join(' ');
  if (formatted) resource.name = { ...resource.name, formatted };
  if (resource[SCIM_ENTERPRISE]) resource.schemas.push(SCIM_ENTERPRISE);
  return resource;
};

export const PAYLOAD_BUILDERS = { okta: toOkta, scim: toScim };

// ─── Reading (external user → identity) ───────────────────────────────

// The element of a multi-valued attribute a selector reads. Falls back like AD/Okta clients expect:
// email → primary → first; work phone → primary non-mobile; work address → primary → first.
const pickElement = (list, attr, type) => {
  if (!Array.isArray(list) || !list.length) return undefined;
  const byType = list.find(e => e.type === type);
  if (byType || type === 'mobile') return byType;
  if (attr === 'phoneNumbers') return list.find(e => e.primary && e.type !== 'mobile');
  return list.find(e => e.primary) || list[0];
};

const getScimPath = (obj, segs) => {
  let cur = obj;
  for (let i = 0; i < segs.length && cur != null; i++) {
    const seg = segs[i];
    const next = segs[i + 1];
    if (isSelector(next)) { cur = pickElement(cur[seg], seg, next.type); i++; }
    else cur = cur[seg];
  }
  return cur;
};

export const oktaToIdentity = (user) => {
  const p = user?.profile || {};
  return cleanIdentity(Object.fromEntries(Object.entries(ATTRIBUTE_MAP).map(([key, { okta }]) => [key, p[okta]])));
};

// email is required locally: a SCIM user without one falls back to its userName
export const scimToIdentity = (resource) => {
  const identity = Object.fromEntries(Object.entries(ATTRIBUTE_MAP).map(([key, { scim }]) => [key, getScimPath(resource || {}, scim)]));
  if (blank(identity.email)) identity.email = resource?.userName;
  return cleanIdentity(identity);
};

// ─── Users row ↔ identity ─────────────────────────────────────────────

export const rowToIdentity = (row) => cleanIdentity({
  ...(row.profile || {}),
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  login: row.login,
});

// The identity columns of a users row (profile as an object; saveUser stores it as JSON)
export const identityToRow = (identity) => {
  const id = cleanIdentity(identity);
  return {
    email: id.email,
    first_name: id.firstName ?? null,
    last_name: id.lastName ?? null,
    login: id.login ?? null,
    profile: Object.fromEntries(PROFILE_KEYS.filter(k => id[k] !== undefined).map(k => [k, id[k]])),
  };
};
