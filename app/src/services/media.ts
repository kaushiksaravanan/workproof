import * as FileSystem from "expo-file-system/legacy";

/**
 * Hermes-safe base64 decoder. We don't depend on `Buffer` (not in RN) or
 * `atob` (Hermes' implementation is flaky for binary payloads), so we
 * decode manually.
 */
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(b64: string): Uint8Array {
  // Strip whitespace and any data: prefix just in case.
  const clean = b64.replace(/\s+/g, "").replace(/^data:[^,]+,/, "");

  const lookup = new Int16Array(256);
  for (let i = 0; i < lookup.length; i++) lookup[i] = -1;
  for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    lookup[BASE64_ALPHABET.charCodeAt(i)] = i;
  }

  let padding = 0;
  if (clean.length > 0 && clean.charCodeAt(clean.length - 1) === 61 /* = */) {
    padding++;
    if (clean.length > 1 && clean.charCodeAt(clean.length - 2) === 61) {
      padding++;
    }
  }

  const inputLength = clean.length;
  const byteLength = Math.floor((inputLength * 3) / 4) - padding;
  const out = new Uint8Array(byteLength);

  let outIndex = 0;
  for (let i = 0; i < inputLength; i += 4) {
    const c0 = lookup[clean.charCodeAt(i)];
    const c1 = lookup[clean.charCodeAt(i + 1)];
    const c2 = lookup[clean.charCodeAt(i + 2)];
    const c3 = lookup[clean.charCodeAt(i + 3)];

    const triple =
      ((c0 < 0 ? 0 : c0) << 18) |
      ((c1 < 0 ? 0 : c1) << 12) |
      ((c2 < 0 ? 0 : c2) << 6) |
      (c3 < 0 ? 0 : c3);

    if (outIndex < byteLength) out[outIndex++] = (triple >> 16) & 0xff;
    if (outIndex < byteLength) out[outIndex++] = (triple >> 8) & 0xff;
    if (outIndex < byteLength) out[outIndex++] = triple & 0xff;
  }

  return out;
}

/**
 * Read a file URI's bytes as a Uint8Array. Uses base64 round-trip because
 * expo-file-system doesn't expose a raw-bytes read on RN.
 */
export async function readBytes(uri: string): Promise<Uint8Array> {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToBytes(b64);
}

/**
 * Copy `srcUri` into the app's document directory under `workproof/`,
 * creating the directory if needed. Returns the new file:// URI.
 */
export async function ensureCopy(
  srcUri: string,
  destDir: string = (FileSystem.documentDirectory ?? "") + "workproof/"
): Promise<string> {
  const dirInfo = await FileSystem.getInfoAsync(destDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  }

  // Pick a stable-ish file name from the source URI, falling back to a
  // timestamp when the source has no recognisable extension.
  const lastSlash = srcUri.lastIndexOf("/");
  const tail = lastSlash >= 0 ? srcUri.slice(lastSlash + 1) : srcUri;
  const safeTail = tail.replace(/[^A-Za-z0-9._-]/g, "_");
  const fileName = safeTail.length > 0 ? safeTail : `file-${Date.now()}`;

  const destUri = destDir + fileName;
  await FileSystem.copyAsync({ from: srcUri, to: destUri });
  return destUri;
}
