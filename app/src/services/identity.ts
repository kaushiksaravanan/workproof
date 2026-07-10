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
  try {
    const existing = await SecureStore.getItemAsync(SECURE_KEY);
    if (existing) {
      const w = new Wallet(existing);
      cachedWallet = w;
      return w;
    }
  } catch {
    // Fall through to generate — secure-store read failures are rare but
    // shouldn't crash the app. If persistence fails on write we still
    // return the in-memory wallet.
  }
  const fresh = Wallet.createRandom();
  cachedWallet = new Wallet(fresh.privateKey);
  try {
    await SecureStore.setItemAsync(SECURE_KEY, fresh.privateKey);
  } catch {
    // ignored — see comment above
  }
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
