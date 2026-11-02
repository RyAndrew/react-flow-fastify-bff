const REDACTED = '[REDACTED]';
const SECRET_KEYS = new Set(['password']);

/**
 * Deep-copies a JSON value, masking secrets before it is persisted to logs.
 * Masks any `password` key, plus SCIM PatchOp operations whose `path` is `password`.
 */
export function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SECRET_KEYS.has(key.toLowerCase()) ? REDACTED : redactSecrets(val);
  }
  if (typeof out.path === 'string' && SECRET_KEYS.has(out.path.toLowerCase()) && 'value' in out) {
    out.value = REDACTED;
  }
  return out;
}
