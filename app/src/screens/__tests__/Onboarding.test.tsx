import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Onboarding } from '../Onboarding';
import { ThemeProvider } from '../../theme/ThemeProvider';

// Skip the fade animation entirely so test progress doesn't depend on
// Animated.timing draining a real timer queue.
jest.mock('../../theme/useReducedMotion', () => ({
  useReducedMotion: () => true,
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

describe('Onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockReset?.();
    (AsyncStorage.setItem as jest.Mock).mockReset?.();
  });

  it('renders the first slide headline after AsyncStorage resolves with null', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const onComplete = jest.fn();

    const { findByText } = render(wrap(<Onboarding onComplete={onComplete} />));

    // Wait for the AsyncStorage.getItem promise to resolve and ready to flip true.
    const headline = await findByText('Log your work today.');
    expect(headline).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('advances to slide 2 ("Yours, offline.") when Next is pressed', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const onComplete = jest.fn();

    const { findByText, getByText, queryByText } = render(
      wrap(<Onboarding onComplete={onComplete} />),
    );

    await findByText('Log your work today.');

    await act(async () => {
      fireEvent.press(getByText('Next'));
    });

    await waitFor(() => {
      expect(queryByText('Yours, offline.')).toBeTruthy();
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows "Get started" CTA on the final slide', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const onComplete = jest.fn();

    const { findByText, getByText, queryByText } = render(
      wrap(<Onboarding onComplete={onComplete} />),
    );

    await findByText('Log your work today.');

    await act(async () => {
      fireEvent.press(getByText('Next'));
    });
    await waitFor(() => expect(queryByText('Yours, offline.')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Next'));
    });

    await waitFor(() => expect(queryByText('Get started')).toBeTruthy());
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete when "Get started" is pressed on the final slide', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValueOnce(undefined);
    const onComplete = jest.fn();

    const { findByText, getByText, queryByText } = render(
      wrap(<Onboarding onComplete={onComplete} />),
    );

    await findByText('Log your work today.');

    await act(async () => {
      fireEvent.press(getByText('Next'));
    });
    await waitFor(() => expect(queryByText('Yours, offline.')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Next'));
    });
    await waitFor(() => expect(queryByText('Get started')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Get started'));
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('still renders the flow if AsyncStorage.getItem rejects mid-flight', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error('storage unavailable'),
    );
    const onComplete = jest.fn();

    const { findByText } = render(wrap(<Onboarding onComplete={onComplete} />));

    // Even though storage threw, the user must still see slide 1.
    const headline = await findByText('Log your work today.');
    expect(headline).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('only fires onComplete once even when "Get started" is double-tapped racing setItem', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    // Hold setItem pending so the second tap races the first.
    let resolveSet: (() => void) | null = null;
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSet = () => resolve();
        }),
    );
    const onComplete = jest.fn();

    const { findByText, getByText, queryByText } = render(
      wrap(<Onboarding onComplete={onComplete} />),
    );

    await findByText('Log your work today.');
    await act(async () => {
      fireEvent.press(getByText('Next'));
    });
    await waitFor(() => expect(queryByText('Yours, offline.')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Next'));
    });
    await waitFor(() => expect(queryByText('Get started')).toBeTruthy());

    // Two synchronous taps before the first setItem resolves.
    await act(async () => {
      fireEvent.press(getByText('Get started'));
      fireEvent.press(getByText('Get started'));
    });

    // Now resolve the in-flight setItem.
    await act(async () => {
      resolveSet?.();
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    // setItem should have been called exactly once — the completedRef guard
    // must short-circuit the second tap before it touches storage.
    expect((AsyncStorage.setItem as jest.Mock).mock.calls.length).toBe(1);
  });

  it('still fires onComplete if AsyncStorage.setItem rejects on completion', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('disk full'),
    );
    const onComplete = jest.fn();

    const { findByText, getByText, queryByText } = render(
      wrap(<Onboarding onComplete={onComplete} />),
    );

    await findByText('Log your work today.');
    await act(async () => {
      fireEvent.press(getByText('Next'));
    });
    await waitFor(() => expect(queryByText('Yours, offline.')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Next'));
    });
    await waitFor(() => expect(queryByText('Get started')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Get started'));
    });

    // Even though setItem failed, the user is not stranded.
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('announces each slide change for screen-reader users', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    const onComplete = jest.fn();

    const { findByText, getByText, queryByText } = render(
      wrap(<Onboarding onComplete={onComplete} />),
    );

    await findByText('Log your work today.');

    await act(async () => {
      fireEvent.press(getByText('Next'));
    });
    await waitFor(() => expect(queryByText('Yours, offline.')).toBeTruthy());

    expect(announceSpy).toHaveBeenCalledWith(
      expect.stringContaining('Slide 2 of 3'),
    );
    expect(announceSpy).toHaveBeenCalledWith(
      expect.stringContaining('Yours, offline.'),
    );

    await act(async () => {
      fireEvent.press(getByText('Next'));
    });
    await waitFor(() => expect(queryByText('Get started')).toBeTruthy());

    expect(announceSpy).toHaveBeenCalledWith(
      expect.stringContaining('Slide 3 of 3'),
    );

    announceSpy.mockRestore();
  });

  it('short-circuits to onComplete when AsyncStorage.getItem returns "true"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');
    const onComplete = jest.fn();

    const { queryByText } = render(wrap(<Onboarding onComplete={onComplete} />));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));

    // The slide content must never render.
    expect(queryByText('Log your work today.')).toBeNull();
    expect(queryByText('Yours, offline.')).toBeNull();
    expect(queryByText('One tap, on-chain.')).toBeNull();
    expect(queryByText('Get started')).toBeNull();
    expect(queryByText('Next')).toBeNull();
  });
});
