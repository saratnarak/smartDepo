/**
 * The audit log keeps readable details of every change. Some of those details could hold a
 * password hash, a token, or a key of the storage, so every JSON value of an entry is cleaned
 * before it is shown: a key that looks secret is removed, everything else is kept.
 */
const SENSITIVE_KEY_PATTERN =
  /password|passwd|token|secret|hash|apikey|api_key|accesskey|access_key|authorization|cookie|jwt|privatekey|private_key|credential|signature/i;

/** The keys that were removed from a value, so the caller can see that something was hidden. */
export interface SanitizedAuditValue {
  value: unknown;
  removedKeys: string[];
}

function sanitize(value: unknown, removed: string[], path: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) => sanitize(entry, removed, `${path}[${String(index)}]`));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        removed.push(path === '' ? key : `${path}.${key}`);
        continue;
      }

      result[key] = sanitize(nested, removed, path === '' ? key : `${path}.${key}`);
    }

    return result;
  }

  return value;
}

/** Cleans one JSON value of an audit entry and lists the keys that were removed. */
export function sanitizeAuditValue(value: unknown): SanitizedAuditValue {
  const removed: string[] = [];
  const cleaned = sanitize(value, removed, '');

  return { value: cleaned, removedKeys: removed };
}

/** Cleans one JSON value of an audit entry. */
export function sanitizeAuditJson(value: unknown): unknown {
  return sanitizeAuditValue(value).value;
}
