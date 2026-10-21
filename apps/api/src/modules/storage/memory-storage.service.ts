import type { ObjectInspection, StorageProvider } from './storage.provider.js';

interface StoredObject {
  bytes: Buffer;
  contentType: string;
}

/**
 * In-memory storage used by every test. It never talks to R2 and exposes putObject so tests can
 * simulate the client upload before calling the confirm endpoint.
 */
export class MemoryStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, StoredObject>();
  private readonly baseUrl = 'https://memory-r2.invalid';

  presignUploadUrl(key: string, contentType: string): Promise<string> {
    return Promise.resolve(
      `${this.baseUrl}/upload/${encodeURIComponent(key)}?contentType=${encodeURIComponent(contentType)}`,
    );
  }

  presignReadUrl(key: string): Promise<string> {
    return Promise.resolve(`${this.baseUrl}/read/${encodeURIComponent(key)}`);
  }

  inspectObject(key: string): Promise<ObjectInspection | null> {
    const stored = this.objects.get(key);

    if (stored === undefined) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      contentType: stored.contentType,
      contentLength: stored.bytes.length,
      magicBytes: stored.bytes.subarray(0, 16),
    });
  }

  deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  putObject(key: string, bytes: Buffer, contentType: string): void {
    this.objects.set(key, { bytes: Buffer.from(bytes), contentType });
  }
}
