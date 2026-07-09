/**
 * useReducedMotion — post-unmount safety
 *
 * Focus: when AccessibilityInfo.isReduceMotionEnabled() resolves AFTER the
 * component has unmounted, the hook must NOT call setReduce — otherwise React
 * 18+ logs a "not wrapped in act(...)" warning. The hook gates the resolved
 * branch on a `mounted` flag that the cleanup function flips to false.
 *
 * Strategy: mock AccessibilityInfo.isReduceMotionEnabled to return a promise
 * we control, render the hook, unmount synchronously, THEN resolve the
 * promise. If the gate works, no console.error is emitted.
 */

import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReducedMotion } from '../useReducedMotion';

describe('useReducedMotion — does not setReduce after unmount', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('does not warn when AccessibilityInfo resolves post-unmount', async () => {
    let resolveFn: (v: boolean) => void = () => {};
    const pending = new Promise<boolean>((resolve) => {
      resolveFn = resolve;
    });

    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(pending);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >);

    const { result, unmount } = renderHook(() => useReducedMotion());

    // Default state before any resolution.
    expect(result.current).toBe(false);

    // Unmount BEFORE the AccessibilityInfo promise resolves.
    unmount();

    // Now resolve the promise. The hook's `.then` fires post-unmount.
    resolveFn(true);
    await pending;
    // Flush microtasks so the .then handler runs.
    await Promise.resolve();
    await Promise.resolve();

    // No act() warning should have been emitted.
    const actWarnings = errorSpy.mock.calls.filter((args: unknown[]) =>
      args.some(
        (a: unknown) =>
          typeof a === 'string' && a.includes('not wrapped in act'),
      ),
    );
    expect(actWarnings).toHaveLength(0);
  });

  it('returns false initially and accepts a resolved value pre-unmount', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >);

    const { result, unmount } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
    unmount();
  });

  it('swallows AccessibilityInfo rejection without throwing', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockRejectedValue(new Error('platform not supported'));
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >);

    const { result, unmount } = renderHook(() => useReducedMotion());

    // Flush the rejection.
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current).toBe(false);
    unmount();
  });

  it('removes the reduceMotionChanged listener on unmount', () => {
    const remove = jest.fn();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >);

    const { unmount } = renderHook(() => useReducedMotion());
    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('reduceMotionChanged listener flips the value while mounted', async () => {
    // Capture the listener the hook registers so we can invoke it manually.
    let listener: ((enabled: boolean) => void) | undefined;
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockImplementation(((event: string, cb: (enabled: boolean) => void) => {
        if (event === 'reduceMotionChanged') listener = cb;
        return { remove: jest.fn() } as unknown as ReturnType<
          typeof AccessibilityInfo.addEventListener
        >;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any);

    const { result } = renderHook(() => useReducedMotion());
    // Flush the initial isReduceMotionEnabled promise.
    await Promise.resolve();
    await Promise.resolve();
    expect(result.current).toBe(false);
    expect(listener).toBeDefined();

    // Simulate the OS toggling Reduce Motion on. This exercises the
    // in-listener `if (mounted) setReduce(enabled)` branch (line 27). Wrap
    // in act() so React commits the setState before we assert.
    await act(async () => {
      listener?.(true);
    });
    expect(result.current).toBe(true);

    // And toggling back off:
    await act(async () => {
      listener?.(false);
    });
    expect(result.current).toBe(false);
  });

  it('post-unmount reduceMotionChanged events do NOT setReduce (mounted gate)', async () => {
    let listener: ((enabled: boolean) => void) | undefined;
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockImplementation(((event: string, cb: (enabled: boolean) => void) => {
        if (event === 'reduceMotionChanged') listener = cb;
        return { remove: jest.fn() } as unknown as ReturnType<
          typeof AccessibilityInfo.addEventListener
        >;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any);

    const { unmount } = renderHook(() => useReducedMotion());
    await Promise.resolve();
    unmount();
    // Fire event AFTER unmount. mounted is false; setReduce must NOT be
    // called. If it were, react-test-renderer would log a "not wrapped in
    // act" warning, which our afterEach spy catches.
    listener?.(true);
    await Promise.resolve();
    await Promise.resolve();
    const actWarnings = errorSpy.mock.calls.filter((args: unknown[]) =>
      args.some(
        (a: unknown) =>
          typeof a === 'string' && a.includes('not wrapped in act'),
      ),
    );
    expect(actWarnings).toHaveLength(0);
  });
});
