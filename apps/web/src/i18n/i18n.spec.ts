import en from './en.json';
import km from './km.json';

type Dictionary = Record<string, unknown>;

function collectKeyPaths(source: Dictionary, prefix = ''): string[] {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return collectKeyPaths(value as Dictionary, path);
    }
    return [path];
  });
}

function collectEmptyKeyPaths(source: Dictionary, prefix = ''): string[] {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return collectEmptyKeyPaths(value as Dictionary, path);
    }
    return typeof value === 'string' && value.trim() === '' ? [path] : [];
  });
}

describe('i18n dictionaries', () => {
  it('English and Khmer have the same keys', () => {
    expect(collectKeyPaths(km).sort()).toEqual(collectKeyPaths(en).sort());
  });

  it('has no empty translations', () => {
    expect(collectEmptyKeyPaths(en)).toEqual([]);
    expect(collectEmptyKeyPaths(km)).toEqual([]);
  });
});
