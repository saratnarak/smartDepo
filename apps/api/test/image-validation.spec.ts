import {
  detectImageContentType,
  extForContentType,
  MAX_IMAGE_BYTES,
} from '../src/modules/storage/image-validation.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const webp = Buffer.from('RIFF\x00\x00\x00\x00WEBPxxxx', 'latin1');
const text = Buffer.from('not an image at all');

describe('image type validation', () => {
  it('detects JPEG, PNG, and WebP magic bytes', () => {
    expect(detectImageContentType(jpeg)).toBe('image/jpeg');
    expect(detectImageContentType(png)).toBe('image/png');
    expect(detectImageContentType(webp)).toBe('image/webp');
  });

  it('rejects non-image content', () => {
    expect(detectImageContentType(text)).toBeNull();
    expect(detectImageContentType(Buffer.alloc(0))).toBeNull();
  });

  it('maps content types to file extensions', () => {
    expect(extForContentType('image/jpeg')).toBe('jpg');
    expect(extForContentType('image/png')).toBe('png');
    expect(extForContentType('image/webp')).toBe('webp');
    expect(extForContentType('image/gif')).toBeNull();
  });

  it('uses the required 2 MB limit', () => {
    expect(MAX_IMAGE_BYTES).toBe(2 * 1024 * 1024);
  });
});
