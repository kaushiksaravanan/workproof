/**
 * useHaptics — SUCCESSFUL load path.
 *
 * The sibling useHaptics.test.ts covers the "expo-haptics unavailable"
 * fallback (require() throws → cachedHaptics=null). Because useHaptics caches
 * that null at module scope, we call __resetHapticsCacheForTests() before
 * each test in this file so the fresh throwing-free mock gets picked up.
 */

import { renderHook } from '@testing-library/react-native';
import { useHaptics, __resetHapticsCacheForTests } from '../useHaptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async (_style: unknown) => undefined),
  notificationAsync: jest.fn(async (_type: unknown) => undefined),
  ImpactFeedbackStyle: {
    Light: 'LightSym',
    Medium: 'MediumSym',
    Heavy: 'HeavySym',
  },
  NotificationFeedbackType: {
    Success: 'SuccessSym',
    Warning: 'WarningSym',
    Error: 'ErrorSym',
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Haptics = require('expo-haptics') as {
  selectionAsync: jest.Mock;
  impactAsync: jest.Mock;
  notificationAsync: jest.Mock;
};

beforeEach(() => {
  __resetHapticsCacheForTests();
  Haptics.selectionAsync.mockClear();
  Haptics.impactAsync.mockClear();
  Haptics.notificationAsync.mockClear();
});

describe('useHaptics — successful load wires each method', () => {
  it('selection() → Haptics.selectionAsync()', () => {
    const { result } = renderHook(() => useHaptics());
    result.current.selection();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('impactLight() → Haptics.impactAsync(ImpactFeedbackStyle.Light)', () => {
    const { result } = renderHook(() => useHaptics());
    result.current.impactLight();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('LightSym');
  });

  it('impactMedium() → Haptics.impactAsync(ImpactFeedbackStyle.Medium)', () => {
    const { result } = renderHook(() => useHaptics());
    result.current.impactMedium();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('MediumSym');
  });

  it('success() → Haptics.notificationAsync(NotificationFeedbackType.Success)', () => {
    const { result } = renderHook(() => useHaptics());
    result.current.success();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('SuccessSym');
  });

  it('warning() → Haptics.notificationAsync(NotificationFeedbackType.Warning)', () => {
    const { result } = renderHook(() => useHaptics());
    result.current.warning();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('WarningSym');
  });

  it('error() → Haptics.notificationAsync(NotificationFeedbackType.Error)', () => {
    const { result } = renderHook(() => useHaptics());
    result.current.error();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('ErrorSym');
  });

  it('swallows a rejected haptic promise silently (never rejects the caller)', async () => {
    Haptics.selectionAsync.mockImplementationOnce(() =>
      Promise.reject(new Error('haptic device unavailable')),
    );
    const { result } = renderHook(() => useHaptics());
    expect(() => result.current.selection()).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });

  it('swallows a synchronous throw from Haptics.selectionAsync silently', () => {
    Haptics.selectionAsync.mockImplementationOnce(() => {
      throw new Error('sync boom');
    });
    const { result } = renderHook(() => useHaptics());
    expect(() => result.current.selection()).not.toThrow();
  });
});
