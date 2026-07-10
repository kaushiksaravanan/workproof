/**
 * Unit tests for services/identity.ts — per-install worker wallet.
 *
 * expo-secure-store is mocked globally in jest.setup.js with an in-memory
 * map. That means these tests exercise the real getOrCreateWallet /
 * __resetIdentityForTests code paths against a realistic secure-store
 * shape, without the native module.
 */

import {
  getOrCreateWallet,
  __resetIdentityForTests,
} from '../identity';
import * as SecureStore from 'expo-secure-store';

const SECURE_KEY = 'workproof-identity-v1';

beforeEach(async () => {
  // Wipe both the in-memory secure-store and the module's cached wallet
  // so each test starts from a clean 'first launch' state.
  (
    SecureStore as unknown as { __resetForTests: () => void }
  ).__resetForTests();
  await __resetIdentityForTests();
  // Reset call counters on the SecureStore mock functions so per-test
  // toHaveBeenCalledTimes assertions aren't polluted by prior tests.
  (SecureStore.getItemAsync as jest.Mock).mockClear();
  (SecureStore.setItemAsync as jest.Mock).mockClear();
  (SecureStore.deleteItemAsync as jest.Mock).mockClear();
});

describe('getOrCreateWallet', () => {
  it('generates a fresh wallet on first call and persists it to secure-store', async () => {
    const wallet = await getOrCreateWallet();
    expect(wallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    // The private key landed in secure-store under the versioned key.
    const persisted = await SecureStore.getItemAsync(SECURE_KEY);
    expect(persisted).toBeTruthy();
    expect(persisted).toMatch(/^0x[0-9a-fA-F]{64}$/);
    // secure-store received a write.
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SECURE_KEY, persisted);
  });

  it('second call returns the SAME wallet (in-memory cache)', async () => {
    const first = await getOrCreateWallet();
    const second = await getOrCreateWallet();
    expect(second.address).toBe(first.address);
    // secure-store was written exactly once — cache hit on the second call.
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('reloads the same wallet across a cache reset (persistence check)', async () => {
    const first = await getOrCreateWallet();
    await __resetIdentityForTests();
    // Re-populate the secure-store (reset also wiped it — put the key back
    // to simulate 'app restart with same install').
    await SecureStore.setItemAsync(SECURE_KEY, first.privateKey);
    const restored = await getOrCreateWallet();
    expect(restored.address).toBe(first.address);
  });

  it('concurrent first-call awaits share the same in-flight promise', async () => {
    // Regression: without the `inFlight` guard, two concurrent
    // getOrCreateWallet() calls on first launch would each generate their
    // own wallet and race on the secure-store write — whichever landed
    // last would win and the other caller would get a wallet that isn't
    // the one actually persisted.
    const [a, b, c] = await Promise.all([
      getOrCreateWallet(),
      getOrCreateWallet(),
      getOrCreateWallet(),
    ]);
    expect(a.address).toBe(b.address);
    expect(b.address).toBe(c.address);
    // Exactly one setItemAsync call — not three.
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('falls back to a fresh (in-memory) wallet if secure-store read throws', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('keychain locked'),
    );
    const wallet = await getOrCreateWallet();
    // Still returns a valid wallet — we don't crash the caller.
    expect(wallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('returns the in-memory wallet even if secure-store write throws (best-effort persist)', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('keychain full'),
    );
    const wallet = await getOrCreateWallet();
    // Wallet still usable for this session; the persist just didn't stick.
    expect(wallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('two distinct installs generate DIFFERENT wallets (no shared demo key)', async () => {
    // Regression on task #33: the previous design used a single
    // HACKATHON_DEMO_KEY shipped in the APK bundle, so every install
    // shared the same on-chain identity. New behavior: every fresh
    // secure-store starts a distinct wallet.
    const walletA = await getOrCreateWallet();
    // Simulate 'installed on a different device' — wipe secure-store AND
    // the module cache, then call again.
    (
      SecureStore as unknown as { __resetForTests: () => void }
    ).__resetForTests();
    await __resetIdentityForTests();
    const walletB = await getOrCreateWallet();
    expect(walletA.address).not.toBe(walletB.address);
  });
});
