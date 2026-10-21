import { MemoryStorageProvider } from '../src/modules/storage/memory-storage.service.js';
import { R2StorageProvider } from '../src/modules/storage/r2-storage.service.js';
import { createStorageProvider } from '../src/modules/storage/storage.module.js';

describe('createStorageProvider', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('uses the in-memory provider only in tests', () => {
    process.env.NODE_ENV = 'test';

    expect(createStorageProvider()).toBeInstanceOf(MemoryStorageProvider);
  });

  it('uses the real R2 provider outside tests', () => {
    process.env.NODE_ENV = 'development';

    expect(createStorageProvider()).toBeInstanceOf(R2StorageProvider);
  });
});
