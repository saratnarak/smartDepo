import { MemoryStorageProvider } from '../src/modules/storage/memory-storage.service.js';

describe('MemoryStorageProvider', () => {
  it('stores, inspects, and deletes objects without any network', async () => {
    const provider = new MemoryStorageProvider();
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    provider.putObject('depots/a/logo/u/1.png', bytes, 'image/png');

    const inspection = await provider.inspectObject('depots/a/logo/u/1.png');
    expect(inspection).toMatchObject({ contentType: 'image/png', contentLength: bytes.length });
    expect(inspection?.magicBytes.equals(bytes)).toBe(true);

    await provider.deleteObject('depots/a/logo/u/1.png');
    expect(await provider.inspectObject('depots/a/logo/u/1.png')).toBeNull();
  });

  it('returns deterministic fake presigned URLs', async () => {
    const provider = new MemoryStorageProvider();

    await expect(provider.presignUploadUrl('k.png', 'image/png', 300)).resolves.toContain(
      '/upload/k.png',
    );
    await expect(provider.presignReadUrl('k.png', 300)).resolves.toContain('/read/k.png');
  });

  it('returns null for a missing object', async () => {
    const provider = new MemoryStorageProvider();
    expect(await provider.inspectObject('missing')).toBeNull();
  });
});
