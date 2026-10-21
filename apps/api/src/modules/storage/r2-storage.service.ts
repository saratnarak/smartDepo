import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { requireEnv } from '../../common/config/env.js';
import type { ObjectInspection, StorageProvider } from './storage.provider.js';

/**
 * Cloudflare R2 through the S3-compatible API. The client is created lazily so the API can boot for
 * development without R2 credentials; the first storage request fails fast if the environment is
 * missing. Credentials are read from environment variables only and are never logged.
 */
export class R2StorageProvider implements StorageProvider {
  private clientCache: S3Client | undefined;

  private client(): S3Client {
    if (this.clientCache === undefined) {
      // The account id is embedded in the endpoint, but read it here so a misconfigured
      // environment fails loudly instead of failing on the first signed request.
      requireEnv('R2_ACCOUNT_ID');

      this.clientCache = new S3Client({
        region: 'auto',
        endpoint: requireEnv('R2_ENDPOINT'),
        credentials: {
          accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
          secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
        },
      });
    }

    return this.clientCache;
  }

  private bucket(): string {
    return requireEnv('R2_BUCKET');
  }

  presignUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client(),
      new PutObjectCommand({ Bucket: this.bucket(), Key: key, ContentType: contentType }),
      { expiresIn: expiresInSeconds },
    );
  }

  presignReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client(), new GetObjectCommand({ Bucket: this.bucket(), Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async inspectObject(key: string): Promise<ObjectInspection | null> {
    try {
      const head = await this.client().send(
        new HeadObjectCommand({ Bucket: this.bucket(), Key: key }),
      );
      const object = await this.client().send(
        new GetObjectCommand({ Bucket: this.bucket(), Key: key, Range: 'bytes=0-15' }),
      );

      const body = object.Body;

      if (body === undefined) {
        throw new Error('Stored object has no body');
      }

      return {
        contentType: head.ContentType,
        contentLength: head.ContentLength,
        magicBytes: Buffer.from(await body.transformToByteArray()),
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      const name = (error as { name?: string }).name;

      if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') {
        return null;
      }

      throw error;
    }
  }

  deleteObject(key: string): Promise<void> {
    return this.client()
      .send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }))
      .then(() => undefined);
  }
}
