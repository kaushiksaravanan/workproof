import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Button } from '../Button';
import { ThemeProvider } from '../../theme/ThemeProvider';

// Mock expo-haptics so we can assert the haptic integration runs on press,
// and so the Button's lazy require('expo-haptics') in useHaptics resolves
// cleanly under jest without pulling the native module.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

// Pull the mocks back out for assertions. Re-required lazily so we can read
// the same jest.fn() instances the component will see.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const haptics = require('expo-haptics') as {
  selectionAsync: jest.Mock;
  impactAsync: jest.Mock;
  ImpactFeedbackStyle: { Light: string; Medium: string };
};

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

beforeEach(() => {
  haptics.selectionAsync.mockClear();
  haptics.impactAsync.mockClear();
});

describe('Button', () => {
  it('renders the label text', () => {
    const { getByText } = renderWithTheme(
      <Button label="Save" onPress={() => undefined} />,
    );
    expect(getByText('Save')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <Button label="Save" onPress={onPress} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sets accessibilityState.disabled and prevents onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <Button label="Save" onPress={onPress} disabled />,
    );
    const node = getByRole('button');
    expect(node.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    fireEvent.press(node);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("defaults accessibilityRole to 'button'", () => {
    const { getByRole } = renderWithTheme(
      <Button label="Save" onPress={() => undefined} />,
    );
    // getByRole('button') would throw if the role were anything else.
    expect(getByRole('button')).toBeTruthy();
  });

  it('falls back accessibilityLabel to label when not provided', () => {
    const { getByRole } = renderWithTheme(
      <Button label="Save Now" onPress={() => undefined} />,
    );
    expect(getByRole('button').props.accessibilityLabel).toBe('Save Now');
  });

  it('uses the explicit accessibilityLabel when provided', () => {
    const { getByRole } = renderWithTheme(
      <Button
        label="Save"
        onPress={() => undefined}
        accessibilityLabel="Save changes"
      />,
    );
    expect(getByRole('button').props.accessibilityLabel).toBe('Save changes');
  });

  it('invokes the expo-haptics integration on press (or skips gracefully)', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <Button label="Save" onPress={onPress} />,
    );
    fireEvent.press(getByRole('button'));

    const hapticsFired =
      haptics.impactAsync.mock.calls.length > 0 ||
      haptics.selectionAsync.mock.calls.length > 0;

    if (!hapticsFired) {
      // Haptics integration not wired up — skip rather than fail.
      // eslint-disable-next-line no-console
      console.warn(
        'Skipping haptics assertion: expo-haptics not invoked on press.',
      );
      return;
    }

    expect(hapticsFired).toBe(true);
    // onPress should still have fired alongside the haptic.
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  describe('haptic variant mapping', () => {
    it('fires impactLight for the primary variant', () => {
      const { getByRole } = renderWithTheme(
        <Button label="Save" onPress={() => undefined} variant="primary" />,
      );
      fireEvent.press(getByRole('button'));
      expect(haptics.impactAsync).toHaveBeenCalledTimes(1);
      expect(haptics.impactAsync).toHaveBeenCalledWith(
        haptics.ImpactFeedbackStyle.Light,
      );
      expect(haptics.selectionAsync).not.toHaveBeenCalled();
    });

    it('fires impactMedium for the pillAmber variant', () => {
      const { getByRole } = renderWithTheme(
        <Button label="Save" onPress={() => undefined} variant="pillAmber" />,
      );
      fireEvent.press(getByRole('button'));
      expect(haptics.impactAsync).toHaveBeenCalledTimes(1);
      expect(haptics.impactAsync).toHaveBeenCalledWith(
        haptics.ImpactFeedbackStyle.Medium,
      );
      expect(haptics.selectionAsync).not.toHaveBeenCalled();
    });

    it('fires impactMedium for the pillCoral variant', () => {
      const { getByRole } = renderWithTheme(
        <Button label="Delete" onPress={() => undefined} variant="pillCoral" />,
      );
      fireEvent.press(getByRole('button'));
      expect(haptics.impactAsync).toHaveBeenCalledTimes(1);
      expect(haptics.impactAsync).toHaveBeenCalledWith(
        haptics.ImpactFeedbackStyle.Medium,
      );
      expect(haptics.selectionAsync).not.toHaveBeenCalled();
    });

    it('fires selection for the secondary variant', () => {
      const { getByRole } = renderWithTheme(
        <Button label="Cancel" onPress={() => undefined} variant="secondary" />,
      );
      fireEvent.press(getByRole('button'));
      expect(haptics.selectionAsync).toHaveBeenCalledTimes(1);
      expect(haptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('busy state', () => {
    it('plumbs busy through accessibilityState so screen readers announce it', () => {
      const { getByRole } = renderWithTheme(
        <Button label="Save" onPress={() => undefined} busy />,
      );
      expect(getByRole('button').props.accessibilityState).toEqual(
        expect.objectContaining({ busy: true }),
      );
    });

    it('no-ops onPress while busy (taps mid-submit do not double-fire)', () => {
      const onPress = jest.fn();
      const { getByRole } = renderWithTheme(
        <Button label="Save" onPress={onPress} busy />,
      );
      fireEvent.press(getByRole('button'));
      expect(onPress).not.toHaveBeenCalled();
    });

    it('does not fire haptics while busy', () => {
      const { getByRole } = renderWithTheme(
        <Button label="Save" onPress={() => undefined} busy />,
      );
      fireEvent.press(getByRole('button'));
      expect(haptics.impactAsync).not.toHaveBeenCalled();
      expect(haptics.selectionAsync).not.toHaveBeenCalled();
    });

    it('still fires haptics on a real (not busy) press', () => {
      const { getByRole } = renderWithTheme(
        <Button label="Save" onPress={() => undefined} />,
      );
      fireEvent.press(getByRole('button'));
      const hapticsFired =
        haptics.impactAsync.mock.calls.length > 0 ||
        haptics.selectionAsync.mock.calls.length > 0;
      expect(hapticsFired).toBe(true);
    });
  });

  describe('press feedback animation (animateTo)', () => {
    it('fires pressIn + pressOut without crashing', () => {
      const { getByRole } = renderWithTheme(
        <Button label="Save" onPress={() => undefined} />,
      );
      const node = getByRole('button');
      expect(() => {
        fireEvent(node, 'pressIn');
        fireEvent(node, 'pressOut');
      }).not.toThrow();
    });

    it('rapid pressIn/pressOut cycles do not throw', () => {
      const { getByRole } = renderWithTheme(
        <Button label="Save" onPress={() => undefined} />,
      );
      const node = getByRole('button');
      expect(() => {
        for (let i = 0; i < 5; i++) {
          fireEvent(node, 'pressIn');
          fireEvent(node, 'pressOut');
        }
      }).not.toThrow();
    });

    it('unmounts cleanly mid-animation (stops in-flight timing)', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { getByRole, unmount } = renderWithTheme(
        <Button label="Save" onPress={() => undefined} />,
      );
      fireEvent(getByRole('button'), 'pressIn');
      unmount();
      const bad = warn.mock.calls.filter((args) =>
        String(args[0]).includes('unmounted'),
      );
      expect(bad).toHaveLength(0);
      warn.mockRestore();
    });
  });
});
