import * as SecureStore from "expo-secure-store";
import { Wallet } from "ethers";

/**
 * Per-install worker identity — a fresh secp256k1 wallet generated on the
 * device the first time the app runs and persisted in expo-secure-store
 * (Keychain on iOS, EncryptedSharedPreferences on Android).
 *
 * Every anchor tx now signs from THIS wallet, not a shared demo key. That
 * means:
 *   - Each install has its own on-chain identity.
 *   - The WorkProofAnchor contract's `Anchored(hash, worker, timestamp)`
 *     event's `worker` field IS the worker's attributable identity.
 *   - Losing the phone loses the identity (this is a feature, not a bug —
 *     it matches how physical proof-of-work receipts are trust-scoped).
 *   - No shared HACKATHON_DEMO_KEY in the APK bundle — closes the
 *     "extract the key with strings on assets/index.android.bundle"
 *     attack surface.
 *
 * The private key never leaves the device. Only the address is embedded
 * in WorkRecord (as workerAddress) so a verifier reading the on-chain
 * Anchored event can match it to a signed proof PDF.
 */

const SECURE_KEY = "workproof-identity-v1";

/**
 * Typed error the caller can catch to distinguish 'identity unavailable
 * right now' (retryable, e.g. keystore locked at boot) from generic
 * failures. UI code should map this to a friendly message instead of
 * showing the internal 'refusing to rotate the wallet' jargon.
 */
export class IdentityUnavailableError extends Error {
  readonly kind: "read" | "parse" | "persist";
  constructor(kind: "read" | "parse" | "persist", message: string) {
    super(message);
    this.name = "IdentityUnavailableError";
    this.kind = kind;
  }
}

/** User-facing friendly message for an IdentityUnavailableError. */
export function friendlyIdentityErrorMessage(err: unknown): string {
  if (err instanceof IdentityUnavailableError) {
    switch (err.kind) {
      case "read":
        return "Your phone's secure storage is locked. Unlock your phone and try again.";
      case "parse":
        return "Your phone's secure storage has a corrupted key. Contact support to recover access to your past proofs — please don't reinstall the app first.";
      case "persist":
        return "Your phone's secure storage isn't writable right now (usually because it's locked). Unlock your phone and try again.";
    }
  }
  return err instanceof Error ? err.message : "Unknown error";
}

let cachedWallet: Wallet | null = null;
let inFlight: Promise<Wallet> | null = null;

/**
 * Return this install's wallet, generating and persisting one if none
 * exists yet. Idempotent — concurrent callers share the same in-flight
 * promise so we never race on the first-launch generate+persist step.
 */
export async function getOrCreateWallet(): Promise<Wallet> {
  if (cachedWallet) return cachedWallet;
  if (inFlight) return inFlight;
  inFlight = _loadOrCreate().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function _loadOrCreate(): Promise<Wallet> {
  // Read the persisted key. Distinguish "no item" from "read/parse error":
  //   - null           → first launch, generate + persist.
  //   - valid hex key  → reuse; wallet identity is stable.
  //   - throw          → transient (Keychain lock race, OS migration, disk),
  //                      or someone/something wrote garbage to our key.
  //     In BOTH cases we must NOT silently overwrite the persisted key with
  //     a fresh one — that would orphan every past on-chain anchor made
  //     from the previous wallet.
  let existing: string | null = null;
  try {
    existing = await SecureStore.getItemAsync(SECURE_KEY);
  } catch (err) {
    throw new IdentityUnavailableError(
      "read",
      "Identity read failure: " +
        (err instanceof Error ? err.message : String(err)) +
        ". Refusing to rotate the wallet — this would orphan any past on-chain anchors.",
    );
  }

  if (existing !== null) {
    try {
      const w = new Wallet(existing);
      cachedWallet = w;
      return w;
    } catch (err) {
      throw new IdentityUnavailableError(
        "parse",
        "Identity parse failure: " +
          (err instanceof Error ? err.message : String(err)) +
          ". Refusing to rotate the wallet — the persisted key is unreadable but present, which means overwriting it would orphan any past on-chain anchors made with the previous key.",
      );
    }
  }

  const fresh = Wallet.createRandom();
  const freshKey = fresh.privateKey;
  try {
    await SecureStore.setItemAsync(SECURE_KEY, freshKey);
  } catch {
    throw new IdentityUnavailableError(
      "persist",
      "Identity persist failure on first launch — cannot save the fresh wallet. Anchoring is unsafe until the OS keystore is writable.",
    );
  }
  cachedWallet = new Wallet(freshKey);
  return cachedWallet;
}

/**
 * Test-only: clear the in-memory cache so a fresh test can force a
 * re-read of secure-store. Also clears the on-disk key so tests get a
 * fresh wallet each run.
 */
export async function __resetIdentityForTests(): Promise<void> {
  cachedWallet = null;
  inFlight = null;
  try {
    await SecureStore.deleteItemAsync(SECURE_KEY);
  } catch {
    // ignore — nothing to clean up
  }
}
