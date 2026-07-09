/**
 * Regression pins for services/config.ts.
 *
 * These are constants (or env-var read-throughs). The point is to catch
 * accidental URL / chain-id changes with a failing test rather than a
 * silent behavior shift.
 */

import {
  CIPHERSTACK_VEND_URL,
  POLYGON_AMOY_RPC,
  POLYGON_AMOY_CHAIN_ID,
} from '../config';

describe('services/config.ts — public constants', () => {
  it('CIPHERSTACK_VEND_URL points at cipherstack.kaushik.cv gemini group', () => {
    expect(CIPHERSTACK_VEND_URL).toBe(
      'https://cipherstack.kaushik.cv/api/v1/vend/gemini',
    );
  });

  it('POLYGON_AMOY_RPC points at the canonical Amoy RPC', () => {
    expect(POLYGON_AMOY_RPC).toBe('https://rpc-amoy.polygon.technology');
  });

  it('POLYGON_AMOY_CHAIN_ID is 80002', () => {
    // https://chainlist.org/chain/80002
    expect(POLYGON_AMOY_CHAIN_ID).toBe(80002);
  });

  it('URLs are https (no accidental http mistake)', () => {
    expect(CIPHERSTACK_VEND_URL.startsWith('https://')).toBe(true);
    expect(POLYGON_AMOY_RPC.startsWith('https://')).toBe(true);
  });
});

describe('services/config.ts — env var read-throughs (shape)', () => {
  it('CIPHERSTACK_TOKEN reads from EXPO_PUBLIC_CIPHERSTACK_TOKEN or is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfg = require('../config') as {
      CIPHERSTACK_TOKEN: string | undefined;
    };
    // In tests without env set, it should be undefined. If someone sets it
    // via a jest globalSetup, the test still passes — the string type is
    // what matters here.
    expect(
      cfg.CIPHERSTACK_TOKEN === undefined ||
        typeof cfg.CIPHERSTACK_TOKEN === 'string',
    ).toBe(true);
  });

  it('HACKATHON_DEMO_KEY has the same shape (string | undefined)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfg = require('../config') as {
      HACKATHON_DEMO_KEY: string | undefined;
    };
    expect(
      cfg.HACKATHON_DEMO_KEY === undefined ||
        typeof cfg.HACKATHON_DEMO_KEY === 'string',
    ).toBe(true);
  });

  it('ANCHOR_CONTRACT_ADDRESS has the same shape (string | undefined)', () => {
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
