/**
 * Regression pins for services/config.ts.
 *
 * These are constants (or env-var read-throughs). The point is to catch
 * accidental URL / chain-id changes with a failing test rather than a
 * silent behavior shift.
 */

import {
  API_VEND_BASE_URL,
  POLYGON_AMOY_RPC,
  POLYGON_AMOY_CHAIN_ID,
} from '../config';

describe('services/config.ts — public constants', () => {
  it('API_VEND_BASE_URL defaults to the workproof-demo Vercel deployment', () => {
    // Native builds hit `${API_VEND_BASE_URL}/api/vend?group=...`. Web
    // builds use same-origin `/api/vend` and ignore this constant.
    expect(API_VEND_BASE_URL).toBe('https://workproof-demo.vercel.app');
  });

  it('POLYGON_AMOY_RPC points at the canonical Amoy RPC', () => {
    expect(POLYGON_AMOY_RPC).toBe('https://rpc-amoy.polygon.technology');
  });

  it('POLYGON_AMOY_CHAIN_ID is 80002', () => {
    // https://chainlist.org/chain/80002
    expect(POLYGON_AMOY_CHAIN_ID).toBe(80002);
  });

  it('URLs are https (no accidental http mistake)', () => {
    expect(API_VEND_BASE_URL.startsWith('https://')).toBe(true);
    expect(POLYGON_AMOY_RPC.startsWith('https://')).toBe(true);
  });
});

describe('services/config.ts — env var read-throughs (shape)', () => {
  it('does NOT export CIPHERSTACK_TOKEN — the token lives server-side', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfg = require('../config') as Record<string, unknown>;
    // Regression: the previous version exported CIPHERSTACK_TOKEN read from
    // EXPO_PUBLIC_CIPHERSTACK_TOKEN, inlining the token into the client
    // bundle. Task #31 removed that; the token now lives only in the
    // /api/vend serverless env. This test locks that in.
    expect(cfg.CIPHERSTACK_TOKEN).toBeUndefined();
    expect('CIPHERSTACK_TOKEN' in cfg).toBe(false);
  });

  it('HACKATHON_DEMO_KEY has the shape string | undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfg = require('../config') as {
      HACKATHON_DEMO_KEY: string | undefined;
    };
    expect(
      cfg.HACKATHON_DEMO_KEY === undefined ||
        typeof cfg.HACKATHON_DEMO_KEY === 'string',
    ).toBe(true);
  });

  it('ANCHOR_CONTRACT_ADDRESS has the shape string | undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfg = require('../config') as {
      ANCHOR_CONTRACT_ADDRESS: string | undefined;
    };
    expect(
      cfg.ANCHOR_CONTRACT_ADDRESS === undefined ||
        typeof cfg.ANCHOR_CONTRACT_ADDRESS === 'string',
    ).toBe(true);
  });
});
