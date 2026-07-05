import { useMemo } from 'react';

/**
 * useHaptics
 *
 * Thin wrapper around expo-haptics that:
 *   - Loads expo-haptics lazily via require() inside try/catch so the hook
 *     works on web / non-iOS / Expo Go-less environments without crashing.
 *   - Returns a stable, memoized object of fire-and-forget functions that
 *     callers can safely include in dependency arrays.
 *
 * NOTE on Reduce Motion:
 *   We deliberately do NOT gate haptics on useReducedMotion(). Per Apple's
 *   Human Interface Guidelines, haptic feedback is treated as an independent
 *   accessibility channel from motion: a user who has Reduce Motion enabled
 *   may still want (and benefit from) tactile confirmation of actions, and
 *   iOS exposes a separate "System Haptics" toggle that the OS itself
 *   honors. Suppressing haptics when reduce-motion is on would override
 *   the user's explicit haptics preference and remove a non-visual cue
 *   that some users rely on. So this hook intentionally fires haptics
 *   regardless of the reduce-motion setting.
 */

type HapticsModule = {
  selectionAsync?: () => Promise<void> | void;
  impactAsync?: (style: unknown) => Promise<void> | void;
  notificationAsync?: (type: unknown) => Promise<void> | void;
  ImpactFeedbackStyle?: {
    Light?: unknown;
    Medium?: unknown;
    Heavy?: unknown;
  };
  NotificationFeedbackType?: {
    Success?: unknown;
    Warning?: unknown;
    Error?: unknown;
  };
};

let cachedHaptics: HapticsModule | null | undefined;

function loadHaptics(): HapticsModule | null {
  if (cachedHaptics !== undefined) {
    return cachedHaptics;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require('expo-haptics') as HapticsModule;
    cachedHaptics = mod ?? null;
  } catch {
    // expo-haptics is unavailable (web, bare RN without the module installed,
    // SSR, etc). Cache the miss so we don't repeatedly try to require it.
    cachedHaptics = null;
  }
  return cachedHaptics;
}

function safeCall(fn: (() => Promise<void> | void) | undefined): void {
  if (!fn) return;
  try {
    const result = fn();
    // expo-haptics returns a Promise; swallow rejections silently so that
    // a failing haptic never breaks the caller's interaction flow.
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).catch(() => {
        /* no-op */
      });
    }
  } catch {
    /* no-op */
  }
}

export interface Haptics {
  selection: () => void;
  impactLight: () => void;
  impactMedium: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
}

export function useHaptics(): Haptics {
  return useMemo<Haptics>(() => {
    const h = loadHaptics();

    if (!h) {
      // Module unavailable — return no-op implementations so callers can
      // invoke haptics unconditionally on every platform.
      const noop = () => {
        /* no-op */
      };
      return {
        selection: noop,
        impactLight: noop,
        impactMedium: noop,
        success: noop,
        warning: noop,
        error: noop,
      };
    }

    const ImpactStyle = h.ImpactFeedbackStyle ?? {};
    const NotificationType = h.NotificationFeedbackType ?? {};

    return {
      selection: () => safeCall(h.selectionAsync),
      impactLight: () =>
        safeCall(
          h.impactAsync ? () => h.impactAsync!(ImpactStyle.Light) : undefined,
        ),
      impactMedium: () =>
        safeCall(
          h.impactAsync ? () => h.impactAsync!(ImpactStyle.Medium) : undefined,
        ),
      success: () =>
        safeCall(
          h.notificationAsync
            ? () => h.notificationAsync!(NotificationType.Success)
            : undefined,
        ),
      warning: () =>
        safeCall(
          h.notificationAsync
            ? () => h.notificationAsync!(NotificationType.Warning)
            : undefined,
        ),
      error: () =>
        safeCall(
          h.notificationAsync
            ? () => h.notificationAsync!(NotificationType.Error)
            : undefined,
        ),
    };
  }, []);
}
