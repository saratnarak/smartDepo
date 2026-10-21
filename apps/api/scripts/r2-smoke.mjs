import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { config } from 'dotenv';

import { requireEnv } from '../src/common/config/env.js';
import { R2StorageProvider } from '../src/modules/storage/r2-storage.service.js';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env'), quiet: true });

const REQUIRED_ENV = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_ENDPOINT',
];

const SENSITIVE_VALUES = REQUIRED_ENV.map((name) => process.env[name]).filter(
  (value) => typeof value === 'string' && value.trim() !== '',
);

class SmokeError extends Error {
  constructor(message, status, hint) {
    super(message);
    this.name = 'SmokeError';
    this.status = status;
    this.hint = hint;
  }
}

function redact(value) {
  let text = String(value ?? '');

  for (const secret of SENSITIVE_VALUES) {
    text = text.split(secret).join('[redacted]');
  }

  return text
    .replace(/https?:\/\/[^\s"'<>]+/g, '[redacted-url]')
    .replace(/X-Amz-[A-Za-z-]+=[^&\s"']+/g, 'X-Amz-[redacted]')
    .replace(/Signature=[^&\s"']+/gi, 'Signature=[redacted]');
}

function errorInfo(error) {
  const status = error?.$metadata?.httpStatusCode ?? error?.status;
  const name = error?.name ?? 'Error';
  const message = redact(error?.message ?? String(error));

  return { status, name, message };
}

function likelyCause(error) {
  if (typeof error?.hint === 'string') {
    return error.hint;
  }

  const { status, name, message } = errorInfo(error);

  if (name === 'CredentialsProviderError' || /credential/i.test(message)) {
    return 'R2 credentials are missing or invalid.';
  }

  if (name === 'RequestTimeTooSkewed' || /skew|signature/i.test(message)) {
    return 'The local clock is not synchronized, or the token/secret is wrong.';
  }

  if (status === 401) {
    return 'The access key is invalid, or the request was unsigned and the bucket is private.';
  }

  if (status === 403) {
    return 'The token lacks Object Read & Write for this bucket, the bucket name is wrong, or the signature expired because of clock skew.';
  }

  if (status === 404) {
    return 'The R2 endpoint, bucket name, or object key is wrong.';
  }

  if (status === 400) {
    return 'The R2 endpoint or bucket configuration is wrong.';
  }

  if (
    name === 'TimeoutError' ||
    name === 'NetworkingError' ||
    /fetch failed|ENOTFOUND|ECONN/i.test(message)
  ) {
    return 'The endpoint host is unreachable (network, DNS, or wrong account endpoint).';
  }

  return 'Check the endpoint, bucket name, token scope, and local clock.';
}

function printPass(step, detail) {
  console.log(`PASS ${step}${detail === undefined ? '' : ` - ${detail}`}`);
}

async function readHttpError(response) {
  try {
    const text = (await response.text()).slice(0, 4096);
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] ?? '';
    const message = /<Message>([^<]+)<\/Message>/.exec(text)?.[1] ?? '';
    return { code: redact(code), message: redact(message) };
  } catch {
    return { code: '', message: '' };
  }
}

function hintForCode(code) {
  switch (code) {
    case 'InvalidAccessKeyId':
      return 'R2_ACCESS_KEY_ID is not valid for this account endpoint.';
    case 'SignatureDoesNotMatch':
      return 'R2_SECRET_ACCESS_KEY is wrong, the account endpoint does not match the token, or the local clock is off.';
    case 'AccessDenied':
      return 'The token lacks the required permission for this operation on the bucket, or a bucket policy denies it.';
    case 'NoSuchBucket':
      return 'R2_BUCKET does not exist in this account.';
    case 'RequestTimeTooSkewed':
      return 'The local clock is not synchronized.';
    case 'InvalidBucketName':
      return 'R2_BUCKET is not a valid bucket name.';
    default:
      return undefined;
  }
}

async function assertStatus(step, response, allowed) {
  if (allowed.includes(response.status)) {
    return;
  }

  const details = await readHttpError(response);
  const suffix = details.code === '' ? '' : ` (${details.code})`;
  const message = details.message === '' ? '' : ` - ${details.message}`;
  throw new SmokeError(
    `${step} returned HTTP ${response.status}${suffix}${message}`,
    response.status,
    hintForCode(details.code),
  );
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

/**
 * Builds a valid 2x2 RGBA PNG in memory. No fixture file or base64 blob is used, so the smoke test
 * proves the bytes it uploads are the bytes it downloads.
 */
function makePng() {
  const width = 2;
  const height = 2;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;

    for (let x = 0; x < width; x += 1) {
      const offset = y * stride + 1 + x * 4;
      raw[offset] = x === 0 ? 0x0f : 0xf2;
      raw[offset + 1] = 0x6b;
      raw[offset + 2] = 0x62;
      raw[offset + 3] = 0xff;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function main() {
  for (const name of REQUIRED_ENV) {
    try {
      requireEnv(name);
    } catch {
      throw new SmokeError(
        `Missing required environment variable: ${name}`,
        undefined,
        'Set the R2 variables in .env (placeholders are in .env.example) before running the smoke test.',
      );
    }
  }

  const provider = new R2StorageProvider();
  const png = makePng();
  const key = `smoke-test/${Date.now()}-${randomBytes(8).toString('hex')}.png`;
  const bucket = requireEnv('R2_BUCKET');
  const endpoint = requireEnv('R2_ENDPOINT').replace(/\/+$/, '');
  let uploaded = false;
  let cleanedUp = false;

  console.log('Cloudflare R2 smoke test');
  console.log('Object prefix: smoke-test/ (all objects created by this run are deleted)');

  try {
    const uploadUrl = await provider.presignUploadUrl(key, 'image/png', 60);
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: png,
    });
    await assertStatus('presigned PUT upload', uploadResponse, [200]);
    uploaded = true;
    printPass('presigned PUT upload', `HTTP ${uploadResponse.status}`);

    const readUrl = await provider.presignReadUrl(key, 60);
    const readResponse = await fetch(readUrl);
    await assertStatus('presigned GET download', readResponse, [200]);
    const downloaded = Buffer.from(await readResponse.arrayBuffer());

    if (!downloaded.equals(png)) {
      throw new SmokeError(
        'presigned GET download returned different bytes',
        readResponse.status,
        'The object was altered in transit or the read URL pointed at a different key.',
      );
    }

    printPass(
      'presigned GET download and byte comparison',
      `HTTP ${readResponse.status}; ${downloaded.length} bytes match`,
    );

    const unsignedUrl = `${endpoint}/${bucket}/${key}`;
    const unsignedResponse = await fetch(unsignedUrl, { redirect: 'manual' });
    const unsignedBody = Buffer.from(await unsignedResponse.arrayBuffer());
    const containsUploadedBytes = unsignedBody.includes(png);
    const isSuccess = unsignedResponse.status >= 200 && unsignedResponse.status < 300;

    if (isSuccess || containsUploadedBytes) {
      throw new SmokeError(
        `unsigned object URL exposed the uploaded object${
          containsUploadedBytes ? ' in its response body' : ''
        }`,
        unsignedResponse.status,
        'The object is publicly readable. Disable public access through an r2.dev address or a custom domain and keep the bucket private.',
      );
    }

    printPass(
      'unsigned object URL is not public',
      `HTTP ${unsignedResponse.status}; rejected without the uploaded bytes`,
    );

    const shortUrl = await provider.presignReadUrl(key, 2);
    const beforeExpiry = await fetch(shortUrl);
    await assertStatus('presigned URL before expiry', beforeExpiry, [200]);
    printPass('presigned URL before 2-second expiry', `HTTP ${beforeExpiry.status}`);

    await sleep(5000);
    const afterExpiry = await fetch(shortUrl);

    if (afterExpiry.status === 200) {
      throw new SmokeError(
        'presigned URL still works after its 2-second expiry',
        afterExpiry.status,
        'The local clock may be far behind, or the R2 presigner did not enforce the expiry. Check clock synchronization.',
      );
    }

    await assertStatus('presigned URL after expiry', afterExpiry, [400, 401, 403]);
    printPass('presigned URL after 2-second expiry is rejected', `HTTP ${afterExpiry.status}`);

    await provider.deleteObject(key);

    let deletedStatus = 0;
    let deletedResponse;
    const deletedUrl = await provider.presignReadUrl(key, 60);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      deletedResponse = await fetch(deletedUrl);
      deletedStatus = deletedResponse.status;

      if (deletedStatus === 404) {
        break;
      }

      await sleep(500);
    }

    if (deletedStatus !== 404) {
      const details =
        deletedResponse === undefined
          ? { code: '', message: '' }
          : await readHttpError(deletedResponse);
      const suffix = details.code === '' ? '' : ` (${details.code})`;
      const message = details.message === '' ? '' : ` - ${details.message}`;
      throw new SmokeError(
        `deleted object returned HTTP ${deletedStatus}${suffix}${message}`,
        deletedStatus,
        'The delete request succeeded but the object is still readable; check bucket consistency and token delete permission.',
      );
    }

    cleanedUp = true;
    printPass('object deleted and no longer readable', `HTTP ${deletedStatus}`);
    console.log('RESULT: PASS');
  } catch (error) {
    const { status, name, message } = errorInfo(error);
    const statusText = status === undefined ? 'no HTTP status' : `HTTP ${status}`;
    console.log(`FAIL ${name}: ${statusText} - ${message}`);
    console.log(`Likely cause: ${likelyCause(error)}`);
    console.log('RESULT: FAIL');
    process.exitCode = 1;
  } finally {
    if (uploaded && !cleanedUp) {
      try {
        await provider.deleteObject(key);
        console.log('PASS cleanup: smoke-test object deleted');
      } catch (error) {
        const { status, name, message } = errorInfo(error);
        console.log(
          `FAIL cleanup ${name}: ${status === undefined ? '' : `HTTP ${status} - `}${message}`,
        );
        process.exitCode = 1;
      }
    }
  }
}

await main();
