export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export const PRESIGN_TTL_SECONDS = 300;

export interface ObjectInspection {
  contentType?: string;
  contentLength?: number;
  magicBytes: Buffer;
}

/**
 * Storage backend abstraction. The real implementation signs Cloudflare R2 requests with the AWS
 * SDK v3; the in-memory implementation is used by every test so tests never contact real R2.
 */
export interface StorageProvider {
  presignUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string>;
  presignReadUrl(key: string, expiresInSeconds: number): Promise<string>;
  inspectObject(key: string): Promise<ObjectInspection | null>;
  deleteObject(key: string): Promise<void>;
}
