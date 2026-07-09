/**
 * Onboarding fade-transition coverage.
 *
 * The main Onboarding.test.tsx mocks useReducedMotion → true so tests stay
 * fast and deterministic (no Animated.timing draining). This companion file
 * flips the mock to false so we exercise the non-reduce-motion transitionTo()
 * branch (Onboarding.tsx L110-135: fadeOut → setIndex → fadeIn).
 */

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Onboarding } from '../Onboarding';
import { ThemeProvider } from '../../theme/ThemeProvider';

jest.mock('../../theme/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      {ui}
    </SafeAreaProvider>
  </ThemeProvider>
);

const FADE_MS = 220;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

describe('Onboarding fade transition (reduceMotion=false)', () => {
  it('advances to slide 2 after pressing Next + draining the fade timer', async () => {
    await AsyncStorage.setItem('@workproof/onboarded', 'false');
    const onComplete = jest.fn();
    const { getByText, queryByText } = render(
      wrap(<Onboarding onComplete={onComplete} />),
    );

    // Slide 1 headline is present.
    await act(async () => {});
    expect(getByText('Log your work today.')).toBeTruthy();

    // Press Next. transitionTo() runs the fadeOut → setIndex(next) → fadeIn
    // sequence, gated on Animated.timing draining. Advance twice: once for
    // fadeOut (220ms), once for fadeIn (220ms).
    fireEvent.press(getByText('Next'));

    // Drain fadeOut. After 220ms + setIndex commit, the headline should flip.
    await act(async () => {
      jest.advanceTimersByTime(FADE_MS);
    });

    expect(queryByText('Log your work today.')).toBeNull();
    expect(getByText('Yours, offline.')).toBeTruthy();

    // Drain fadeIn to clear the animation ref (no assertion needed — we just
    // want to hit the fadeIn.start callback path at L128-134).
    await act(async () => {
      jest.advanceTimersByTime(FADE_MS);
    });
  });

  it('stops an in-flight fade when a second Next tap arrives (animationRef stomp path)', async () => {
    await AsyncStorage.setItem('@workproof/onboarded', 'false');
    const { getByText } = render(wrap(<Onboarding onComplete={() => undefined} />));
    await act(async () => {});

    fireEvent.press(getByText('Next'));
    // Mid-fade: stomp with a second press before the fadeOut lands.
    await act(async () => {
      jest.advanceTimersByTime(FADE_MS / 2);
    });
    fireEvent.press(getByText('Next'));

    // Drain everything.
    await act(async () => {
      jest.advanceTimersByTime(FADE_MS * 3);
    });

    // We can't reliably assert which slide landed (the stomp logic bails one
    // of the transitions), but we can assert the component didn't crash and
    // is still on some slide (its headline is one of the three).
    const headlineFound =
      Boolean(getByText(/Log your work today\.|Yours, offline\.|One tap, on-chain\./));
    expect(headlineFound).toBe(true);
  });

  it('unmounts cleanly mid-fade (cleanup stops the timing)', async () => {
    await AsyncStorage.setItem('@workproof/onboarded', 'false');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { getByText, unmount } = render(
      wrap(<Onboarding onComplete={() => undefined} />),
    );
    await act(async () => {});
    fireEvent.press(getByText('Next'));
    // Drain half the fade so we're mid-animation.
    await act(async () => {
      jest.advanceTimersByTime(FADE_MS / 2);
    });
    unmount();
    // Advance past what would have been the fadeIn callback — if cleanup
    // didn't stop the timing, this would fire setState on an unmounted node.
    await act(async () => {
      jest.advanceTimersByTime(FADE_MS * 2);
    });
    const bad = warn.mock.calls.filter((args) =>
      String(args[0]).includes('unmounted'),
    );
    expect(bad).toHaveLength(0);
    warn.mockRestore();
  });
});
