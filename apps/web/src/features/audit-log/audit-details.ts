/**
 * The readable details of an audit entry (FR-51). The API already removes the secrets of an
 * entry; the screen never shows the raw JSON, it shows the keys and the values of the details as
 * a list, so nothing can leak through a value that was not expected.
 */

export interface AuditValueRow {
  /** The key of the value. */
  key: string;
  /** The value as text, or null when the value has children. */
  value: string | null;
  /** The children of the value when it is an object or a list. */
  children: AuditValueRow[] | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isContainer(value: unknown): boolean {
  return isPlainObject(value) || Array.isArray(value);
}

/** The rows of the values of an audit entry. */
export function auditValueRows(value: unknown): AuditValueRow[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      const children = isContainer(entry) ? auditValueRows(entry) : [];

      return {
        key: String(index + 1),
        value: children.length === 0 ? formatValue(entry) : null,
        children: children.length === 0 ? null : children,
      };
    });
  }

  if (isPlainObject(value)) {
    return Object.entries(value).map(([key, entry]) => {
      const children = isContainer(entry) ? auditValueRows(entry) : [];

      return {
        key,
        value: children.length === 0 ? formatValue(entry) : null,
        children: children.length === 0 ? null : children,
      };
    });
  }

  return [{ key: '', value: formatValue(value), children: null }];
}

/** A value as text. */
export function formatValue(value: unknown): string {
  if (value === null) {
    return '—';
  }

  if (value === undefined) {
    return '—';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '—';
}
