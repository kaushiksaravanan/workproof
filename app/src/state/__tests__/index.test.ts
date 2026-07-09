/**
 * Barrel export test for src/state. One line of source, one line of
 * regression protection: if anyone deletes the useWorkStore export or
 * accidentally adds a leaky store here, this test flags it.
 */

import * as State from '../index';

describe('src/state/index.ts — barrel exports', () => {
  it('exports useWorkStore', () => {
    expect((State as Record<string, unknown>).useWorkStore).toBeDefined();
    // Zustand's create() returns a store function. Assert callable.
    expect(typeof (State as Record<string, unknown>).useWorkStore).toBe(
      'function',
    );
  });

  it('exports exactly [useWorkStore] (no accidental additions)', () => {
    expect(Object.keys(State)).toEqual(['useWorkStore']);
  });
});
