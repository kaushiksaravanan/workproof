import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * useReducedMotion — subscribes to OS reduce-motion preference. Components
 * that animate on press should gate their animations on this value. The
 * `mounted` flag protects against async setReduce firing after test teardown
 * (which would otherwise emit React 18+ "not wrapped in act(...)" warnings).
 */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduce(enabled);
      })
      .catch(() => {
        /* swallow — default false */
      });

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (mounted) setReduce(enabled);
      },
    );

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
