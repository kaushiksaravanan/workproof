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

  it('THROWS on secure-store read failure (does NOT rotate the wallet)', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('keychain locked'),
    );
    // Regression: previously getOrCreateWallet silently fell through to
    // Wallet.createRandom + persist, which would OVERWRITE the persisted
    // key on any transient read failure and orphan every past on-chain
    // anchor. New behavior: surface the read error so the caller can
    // retry or route the user through recovery. Anchoring is refused
    // until the wallet is loadable.
    await expect(getOrCreateWallet()).rejects.toThrow(
      /Identity read failure/,
    );
  });

  it('THROWS on secure-store persist failure during first-launch generate', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('keychain full'),
    );
    // Regression: previously we cached the fresh in-memory wallet even
    // when persistence failed, so this session's anchor would go through
    // — but the cold restart would generate a NEW wallet (empty keystore),
    // orphaning the just-anchored record. Now we throw so the caller
    // can prompt the user before anything gets anchored with an
    // unpersisted key.
    await expect(getOrCreateWallet()).rejects.toThrow(
      /Identity persist failure/,
    );
  });

  it('THROWS on parse failure of persisted key (does NOT overwrite the corrupt value)', async () => {
    // Someone (attacker, or a corrupted keychain migration) wrote garbage
    // into the secure-store key. The old code would generate a fresh
    // wallet and OVERWRITE the garbage — permanently rotating identity
    // without user consent. New code surfaces the error and refuses to
    // overwrite, so the operator can investigate.
    await SecureStore.setItemAsync(SECURE_KEY, 'not-a-hex-key');
    await __resetIdentityForTests();
    // Reset drops the cache — but our __resetForTests helper in setup
    // also nukes the secure-store item, so put it back:
    await SecureStore.setItemAsync(SECURE_KEY, 'not-a-hex-key');
    await expect(getOrCreateWallet()).rejects.toThrow(
      /Identity parse failure/,
    );
    // Assert the persisted key was NOT overwritten.
    expect(await SecureStore.getItemAsync(SECURE_KEY)).toBe('not-a-hex-key');
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
