/**
 * Unit tests for services/media.ts.
 *
 * Two functions to cover:
 *   - readBytes: file:// URI → Uint8Array (via base64 round-trip that
 *     expo-file-system does; the base64 decoder is hand-rolled).
 *   - ensureCopy: creates the destination directory if needed, sanitises
 *     the file name, and copies the source into workproof/.
 *
 * expo-file-system/legacy is mocked with an in-memory FS.
 */

// eslint-disable-next-line no-var
var mockFiles: Map<string, string> = new Map();
// eslint-disable-next-line no-var
var mockDirs: Set<string> = new Set();

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  readAsStringAsync: jest.fn(async (uri: string, _opts?: unknown) => {
    const stored = mockFiles.get(uri);
    if (stored === undefined) throw new Error(`no file: ${uri}`);
    return stored;
  }),
  getInfoAsync: jest.fn(async (uri: string) => ({
    exists: mockDirs.has(uri) || mockFiles.has(uri),
    isDirectory: mockDirs.has(uri),
    uri,
  })),
  makeDirectoryAsync: jest.fn(
    async (uri: string, _opts?: { intermediates?: boolean }) => {
      mockDirs.add(uri);
    },
  ),
  copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const src = mockFiles.get(from);
    if (src === undefined) throw new Error(`copy source missing: ${from}`);
    mockFiles.set(to, src);
  }),
}));

import { readBytes, ensureCopy } from '../media';

// Standard base64 encoder that matches what expo-file-system would return.
function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
  // Clear the auto-generated mock call histories so per-test assertions
  // (e.g. "makeDirectoryAsync was not called") aren't polluted by earlier
  // tests in the same file.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FS = require('expo-file-system/legacy');
  FS.readAsStringAsync.mockClear();
  FS.getInfoAsync.mockClear();
  FS.makeDirectoryAsync.mockClear();
  FS.copyAsync.mockClear();
});

describe('readBytes — base64 → Uint8Array round-trip', () => {
  it('decodes the empty string to a zero-length Uint8Array', async () => {
    mockFiles.set('file:///empty.bin', '');
    const out = await readBytes('file:///empty.bin');
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(0);
  });

  it('decodes a known 4-byte payload correctly (0xde 0xad 0xbe 0xef)', async () => {
    const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    mockFiles.set('file:///dead.bin', encodeBase64(payload));
    const out = await readBytes('file:///dead.bin');
    expect(Array.from(out)).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it('decodes an unpadded 3-byte payload (no = suffix)', async () => {
    // 3 raw bytes → 4 base64 chars, no padding.
    const payload = new Uint8Array([0x01, 0x02, 0x03]);
    mockFiles.set('file:///triplet.bin', encodeBase64(payload));
    const out = await readBytes('file:///triplet.bin');
    expect(Array.from(out)).toEqual([0x01, 0x02, 0x03]);
  });

  it('decodes a 1-byte payload (double = padding)', async () => {
    const payload = new Uint8Array([0x2a]);
    mockFiles.set('file:///one.bin', encodeBase64(payload));
    const out = await readBytes('file:///one.bin');
    expect(Array.from(out)).toEqual([0x2a]);
  });

  it('decodes a 2-byte payload (single = padding)', async () => {
    const payload = new Uint8Array([0xab, 0xcd]);
    mockFiles.set('file:///two.bin', encodeBase64(payload));
    const out = await readBytes('file:///two.bin');
    expect(Array.from(out)).toEqual([0xab, 0xcd]);
  });

  it('strips whitespace before decoding', async () => {
    const payload = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
    const b64 = encodeBase64(payload);
    // Inject whitespace between every 4 chars — real-world "chunked" base64.
    const withSpaces = b64.replace(/(.{4})/g, '$1\n');
    mockFiles.set('file:///padded.bin', withSpaces);
    const out = await readBytes('file:///padded.bin');
    expect(Array.from(out)).toEqual([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
  });

  it('strips a data: prefix if the payload was accidentally left with one', async () => {
    const payload = new Uint8Array([0x0a, 0x0b, 0x0c]);
    const b64 = encodeBase64(payload);
    mockFiles.set('file:///withprefix.bin', `data:image/jpeg;base64,${b64}`);
    const out = await readBytes('file:///withprefix.bin');
    expect(Array.from(out)).toEqual([0x0a, 0x0b, 0x0c]);
  });

  it('decodes 256-byte payload of all byte values (round-trip identity)', async () => {
    const payload = new Uint8Array(256);
    for (let i = 0; i < 256; i++) payload[i] = i;
    mockFiles.set('file:///alldbyte.bin', encodeBase64(payload));
    const out = await readBytes('file:///alldbyte.bin');
    expect(Array.from(out)).toEqual(Array.from(payload));
  });
});

describe('ensureCopy — creates dir, sanitises name, returns dest URI', () => {
  it('creates the destination directory when it does not exist', async () => {
    mockFiles.set('file:///cache/photo.jpg', encodeBase64(new Uint8Array([1])));
    const dest = await ensureCopy('file:///cache/photo.jpg');
    expect(mockDirs.has('file:///doc/workproof/')).toBe(true);
    expect(dest).toBe('file:///doc/workproof/photo.jpg');
  });

  it('skips makeDirectoryAsync when the dir already exists', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FS = require('expo-file-system/legacy') as {
      makeDirectoryAsync: jest.Mock;
    };
    mockDirs.add('file:///doc/workproof/');
    mockFiles.set(
      'file:///cache/photo.jpg',
      encodeBase64(new Uint8Array([1])),
    );
    await ensureCopy('file:///cache/photo.jpg');
    expect(FS.makeDirectoryAsync).not.toHaveBeenCalled();
  });

  it('sanitises unsafe characters in the destination file name', async () => {
    mockFiles.set(
      'file:///cache/weird name with spaces & symbols!.jpg',
      encodeBase64(new Uint8Array([1])),
    );
    const dest = await ensureCopy(
      'file:///cache/weird name with spaces & symbols!.jpg',
    );
    // A-Z, a-z, 0-9, dot, underscore, hyphen preserved; everything else → _.
    expect(dest).toBe(
      'file:///doc/workproof/weird_name_with_spaces___symbols_.jpg',
    );
  });

  it('falls back to a timestamped filename when the source has an empty name', async () => {
    mockFiles.set('file:///cache/', encodeBase64(new Uint8Array([1])));
    const dest = await ensureCopy('file:///cache/');
    expect(dest).toMatch(/^file:\/\/\/doc\/workproof\/file-\d+$/);
  });

  it('respects a custom destination directory when provided', async () => {
    mockFiles.set('file:///cache/photo.jpg', encodeBase64(new Uint8Array([1])));
    const dest = await ensureCopy(
      'file:///cache/photo.jpg',
      'file:///doc/custom-dir/',
    );
    expect(mockDirs.has('file:///doc/custom-dir/')).toBe(true);
    expect(dest).toBe('file:///doc/custom-dir/photo.jpg');
  });

  it('actually copies the bytes through the mocked FS', async () => {
    const payload = encodeBase64(new Uint8Array([0x11, 0x22, 0x33]));
    mockFiles.set('file:///cache/x.bin', payload);
    const dest = await ensureCopy('file:///cache/x.bin');
    expect(mockFiles.get(dest)).toBe(payload);
  });

  it('sanitises consecutive unsafe chars into single underscores per char (not merged)', async () => {
    // "a  b" (two spaces) becomes "a__b" — one underscore per unsafe char,
    // NOT collapsed. Keeps the mapping deterministic for filename dedupe.
    mockFiles.set('file:///cache/a  b.bin', encodeBase64(new Uint8Array([1])));
    const dest = await ensureCopy('file:///cache/a  b.bin');
    expect(dest).toBe('file:///doc/workproof/a__b.bin');
  });
});
