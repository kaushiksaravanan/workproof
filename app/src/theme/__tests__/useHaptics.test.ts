/**
 * useHaptics — graceful failure & API stability
 *
 * Focus: when expo-haptics fails to load, useHaptics returns 6 stable no-op
 * functions that never throw. Also verifies stability of the returned object
 * across re-renders (so callers can put it in dependency arrays).
 *
 * NOTE: useHaptics caches its require() result at module scope. To exercise
 * the "module unavailable" branch deterministically across the whole test
 * file, we mock expo-haptics with a factory that throws — the hook's
 * try/catch turns that into the no-op shape on first call and caches it.
 */

import { renderHook } from '@testing-library/react-native';

jest.mock(
  'expo-haptics',
  () => {
    throw new Error('expo-haptics not installed in this environment');
  },
  { virtual: true },
);

// Import AFTER the mock so the lazy require inside loadHaptics sees the
// throwing factory. Also import the cache-reset helper so this file's null
// cache doesn't leak into useHaptics.loaded.test.ts.
// eslint-disable-next-line import/first
import { useHaptics, __resetHapticsCacheForTests } from '../useHaptics';

beforeEach(() => {
  __resetHapticsCacheForTests();
});

describe('useHaptics — graceful failure when expo-haptics is unavailable', () => {
  it('exposes 6 callable methods', () => {
    const { result } = renderHook(() => useHaptics());

    expect(typeof result.current.selection).toBe('function');
    expect(typeof result.current.impactLight).toBe('function');
    expect(typeof result.current.impactMedium).toBe('function');
    expect(typeof result.current.success).toBe('function');
    expect(typeof result.current.warning).toBe('function');
    expect(typeof result.current.error).toBe('function');
  });

  it('does not throw when any of the 6 methods are invoked', () => {
    const { result } = renderHook(() => useHaptics());

    expect(() => result.current.selection()).not.toThrow();
    expect(() => result.current.impactLight()).not.toThrow();
    expect(() => result.current.impactMedium()).not.toThrow();
    expect(() => result.current.success()).not.toThrow();
    expect(() => result.current.warning()).not.toThrow();
    expect(() => result.current.error()).not.toThrow();
  });

  it('methods return undefined (fire-and-forget, never a rejected promise)', () => {
    const { result } = renderHook(() => useHaptics());

    expect(result.current.selection()).toBeUndefined();
    expect(result.current.impactLight()).toBeUndefined();
    expect(result.current.impactMedium()).toBeUndefined();
    expect(result.current.success()).toBeUndefined();
    expect(result.current.warning()).toBeUndefined();
    expect(result.current.error()).toBeUndefined();
  });

  it('returns the same object reference across re-renders (memoized)', () => {
    const { result, rerender } = renderHook(() => useHaptics());
    const first = result.current;

    rerender({});
    rerender({});
    rerender({});

    expect(result.current).toBe(first);
  });

  it('returns the same per-method function references across re-renders', () => {
    const { result, rerender } = renderHook(() => useHaptics());
    const first = result.current;

    rerender({});

    expect(result.current.selection).toBe(first.selection);
    expect(result.current.impactLight).toBe(first.impactLight);
    expect(result.current.impactMedium).toBe(first.impactMedium);
    expect(result.current.success).toBe(first.success);
    expect(result.current.warning).toBe(first.warning);
    expect(result.current.error).toBe(first.error);
  });

  it('returns equivalent shapes across independent hook instances', () => {
    const a = renderHook(() => useHaptics());
    const b = renderHook(() => useHaptics());

    // Each hook instance creates its own memo, but the SHAPE is identical.
    expect(Object.keys(a.result.current).sort()).toEqual(
      Object.keys(b.result.current).sort(),
    );
    expect(Object.keys(a.result.current).sort()).toEqual([
      'error',
      'impactLight',
      'impactMedium',
      'selection',
      'success',
      'warning',
    ]);
  });
});
