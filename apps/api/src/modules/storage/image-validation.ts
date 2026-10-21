export const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedImageContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export type ImageExtension = 'jpg' | 'png' | 'webp';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const CONTENT_TYPE_TO_EXT: Record<AllowedImageContentType, ImageExtension> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function extForContentType(contentType: string): ImageExtension | null {
  return CONTENT_TYPE_TO_EXT[contentType as AllowedImageContentType] ?? null;
}

export function isAllowedContentType(contentType: string): contentType is AllowedImageContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType);
}

/**
 * Detects the real image type from the leading bytes, not from a Content-Type header. JPEG starts
 * with FF D8 FF, PNG with the 8-byte PNG signature, and WebP with RIFF....WEBP.
 */
export function detectImageContentType(magic: Buffer): AllowedImageContentType | null {
  if (magic.length >= 3 && magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff) {
    return 'image/jpeg';
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (magic.length >= 8 && pngSignature.every((byte, index) => magic[index] === byte)) {
    return 'image/png';
  }

  if (
    magic.length >= 12 &&
    magic.toString('ascii', 0, 4) === 'RIFF' &&
    magic.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}
