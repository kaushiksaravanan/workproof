import * as Crypto from "expo-crypto";
import type { WorkRecord } from "../types";

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    hex += (b < 16 ? "0" : "") + b.toString(16);
  }
  return hex;
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  // Hash the RAW bytes (not their hex representation) so that an external
  // verifier running `sha256sum file.jpg` reproduces the same digest. We
  // route through Crypto.digest with an ArrayBuffer view to avoid the
  // BufferSource / ArrayBufferLike typing churn on TS 5.7+.
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    ab as unknown as ArrayBuffer,
  );
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Produce a deterministic JSON string representation of a record so that
 * hashing is reproducible. Top-level keys are sorted alphabetically and
 * `photoUri` / `audioUri` are replaced with their content hashes so the
 * hash binds to the actual media bytes rather than ephemeral file paths.
 */
export function canonicalize(
  rec: WorkRecord,
  photoHash: string,
  audioHash?: string
): string {
  const replaced: Record<string, unknown> = {
    ...rec,
    photoUri: photoHash,
  };
  if (rec.audioUri !== undefined) {
    replaced.audioUri = audioHash ?? "";
  }

  const keys = Object.keys(replaced).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) {
    ordered[k] = replaced[k];
  }
  return JSON.stringify(ordered);
}

export async function hashRecord(
  rec: WorkRecord,
  photoBytes: Uint8Array,
  audioBytes?: Uint8Array
): Promise<string> {
  const photoHash = await hashBytes(photoBytes);
  const audioHash = audioBytes ? await hashBytes(audioBytes) : undefined;
  const canonical = canonicalize(rec, photoHash, audioHash);

  // Canonical record digest is SHA-256 of UTF-8 encoded canonical JSON bytes.
  // The recipe an external verifier needs:
  //   1. SHA-256 of raw photo bytes (lowercase hex)  -> photoHash
  //   2. SHA-256 of raw audio bytes (lowercase hex)  -> audioHash (if any)
  //   3. Replace photoUri / audioUri in the record with the hashes above
  //   4. Serialize record with keys sorted alphabetically (JSON.stringify)
  //   5. SHA-256 of UTF-8 bytes of that string -> record hash (lowercase hex)
  const encoder = new TextEncoder();
  const canonicalBytes = encoder.encode(canonical);
  return hashBytes(canonicalBytes);
}
