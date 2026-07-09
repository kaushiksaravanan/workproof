/**
 * Unit tests for services/hashing.ts.
 *
 * hashBytes + hashRecord go through expo-crypto's Crypto.digest, which we
 * mock with node's built-in crypto so the tests exercise real SHA-256
 * semantics without pulling in native.
 */

import { createHash } from 'node:crypto';
import { bytesToHex, hashBytes, canonicalize, hashRecord } from '../hashing';
import type { WorkRecord } from '../../types';

jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('node:crypto') as typeof import('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: jest.fn(async (_algo: string, data: ArrayBuffer) => {
      const h = nodeCrypto.createHash('sha256');
      h.update(Buffer.from(new Uint8Array(data)));
      const out = h.digest();
      return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
    }),
  };
});

function bytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

const baseRecord = (over: Partial<WorkRecord> = {}): WorkRecord => ({
  id: 'r1',
  createdAt: '2026-01-01T00:00:00.000Z',
  workType: 'painting',
  amountReceived: 500,
  amountPending: 0,
  photoUri: 'file:///photo.jpg',
  transcript: 'did the wall',
  hash: '',
  ...over,
});

describe('bytesToHex', () => {
  it('encodes 0..255 as 2-digit lowercase hex', () => {
    const arr = new Uint8Array(256);
    for (let i = 0; i < 256; i++) arr[i] = i;
    const hex = bytesToHex(arr);
    expect(hex.length).toBe(512);
    expect(hex.slice(0, 8)).toBe('00010203');
    expect(hex.slice(-8)).toBe('fcfdfeff');
  });

  it('pads single-digit bytes with a leading zero', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff');
  });

  it('returns empty string for empty input', () => {
    expect(bytesToHex(new Uint8Array())).toBe('');
  });
});

describe('hashBytes', () => {
  it('matches node.crypto SHA-256 for known input "abc"', async () => {
    const expected = createHash('sha256').update('abc').digest('hex');
    expect(await hashBytes(bytes('abc'))).toBe(expected);
    // Sanity: NIST test vector for SHA-256('abc').
    expect(expected).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('empty input hashes to the SHA-256 empty digest', async () => {
    expect(await hashBytes(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('is deterministic (same input → same digest across calls)', async () => {
    const a = await hashBytes(bytes('workproof'));
    const b = await hashBytes(bytes('workproof'));
    expect(a).toBe(b);
  });

  it('different inputs produce different digests', async () => {
    const a = await hashBytes(bytes('workproof'));
    const b = await hashBytes(bytes('WorkProof'));
    expect(a).not.toBe(b);
  });

  it('hashes RAW bytes not the hex representation (external-verifier contract)', async () => {
    // If we accidentally hashed the hex encoding we'd get a different digest.
    // Bind the invariant with an explicit assertion against node.crypto.
    const raw = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const ours = await hashBytes(raw);
    const nodeRawHash = createHash('sha256').update(Buffer.from(raw)).digest('hex');
    expect(ours).toBe(nodeRawHash);
  });
});

describe('canonicalize', () => {
  it('sorts top-level keys alphabetically', () => {
    const canonical = canonicalize(baseRecord(), 'ph');
    const parsed = JSON.parse(canonical);
    expect(Object.keys(parsed)).toEqual([...Object.keys(parsed)].sort());
  });

  it('replaces photoUri with the passed photoHash', () => {
    const canonical = canonicalize(baseRecord(), 'PHOTO_HASH');
    expect(JSON.parse(canonical).photoUri).toBe('PHOTO_HASH');
  });

  it('replaces audioUri with the passed audioHash when the record has audio', () => {
    const canonical = canonicalize(
      baseRecord({ audioUri: 'file:///v.m4a' }),
      'ph',
      'AUDIO_HASH',
    );
    expect(JSON.parse(canonical).audioUri).toBe('AUDIO_HASH');
  });

  it("uses '' for audio when record has audioUri but audioHash is undefined", () => {
    const canonical = canonicalize(baseRecord({ audioUri: 'file:///v.m4a' }), 'ph');
    expect(JSON.parse(canonical).audioUri).toBe('');
  });

  it("omits audioUri entirely when the record's audioUri is undefined", () => {
    const canonical = canonicalize(baseRecord(), 'ph');
    expect(JSON.parse(canonical)).not.toHaveProperty('audioUri');
  });

  it('is deterministic: same inputs → same string', () => {
    const a = canonicalize(baseRecord(), 'ph');
    const b = canonicalize(baseRecord(), 'ph');
    expect(a).toBe(b);
  });

  it('is order-independent w.r.t. how the record was built', () => {
    const r1 = { ...baseRecord(), workType: 'painting', amountReceived: 500 } as WorkRecord;
    const r2 = { amountReceived: 500, ...baseRecord(), workType: 'painting' } as WorkRecord;
    expect(canonicalize(r1, 'ph')).toBe(canonicalize(r2, 'ph'));
  });
});

describe('hashRecord', () => {
  it('produces a stable digest for identical inputs', async () => {
    const a = await hashRecord(baseRecord(), bytes('photo'));
    const b = await hashRecord(baseRecord(), bytes('photo'));
    expect(a).toBe(b);
  });

  it('changes when the photo bytes change', async () => {
    const a = await hashRecord(baseRecord(), bytes('photoA'));
    const b = await hashRecord(baseRecord(), bytes('photoB'));
    expect(a).not.toBe(b);
  });

  it('changes when the record body changes', async () => {
    const a = await hashRecord(baseRecord({ amountReceived: 500 }), bytes('p'));
    const b = await hashRecord(baseRecord({ amountReceived: 501 }), bytes('p'));
    expect(a).not.toBe(b);
  });

  it('changes when audio bytes change on an audio-bearing record', async () => {
    const withAudio = baseRecord({ audioUri: 'file:///v.m4a' });
    const a = await hashRecord(withAudio, bytes('p'), bytes('audio-1'));
    const b = await hashRecord(withAudio, bytes('p'), bytes('audio-2'));
    expect(a).not.toBe(b);
  });

  it('is reproducible externally: matches the documented 5-step verifier recipe', async () => {
    // Recreate the recipe from hashing.ts's hashRecord comment using node.crypto.
    const rec = baseRecord();
    const photoBytes = bytes('demo photo bytes');
    const photoHash = createHash('sha256').update(Buffer.from(photoBytes)).digest('hex');
    const replaced = { ...rec, photoUri: photoHash };
    const keys = Object.keys(replaced).sort();
    const ordered: Record<string, unknown> = {};
    for (const k of keys) ordered[k] = (replaced as Record<string, unknown>)[k];
    const canonicalJson = JSON.stringify(ordered);
    const expected = createHash('sha256')
      .update(Buffer.from(new TextEncoder().encode(canonicalJson)))
      .digest('hex');

    expect(await hashRecord(rec, photoBytes)).toBe(expected);
  });

  it('output is 64 lowercase hex chars (SHA-256 digest shape)', async () => {
    const h = await hashRecord(baseRecord(), bytes('p'));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
