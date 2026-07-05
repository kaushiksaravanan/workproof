import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Chip } from '../Chip';
import { ThemeProvider, defaultTheme } from '../../theme/ThemeProvider';

function flatten<T extends object>(style: T | T[] | (T | false | undefined | null)[]): Record<string, unknown> {
  // Mimics StyleSheet.flatten for nested style arrays without pulling in RN's flatten
  // (which works in tests but this is simpler/more explicit).
  const out: Record<string, unknown> = {};
  const walk = (s: unknown) => {
    if (!s) return;
    if (Array.isArray(s)) {
      s.forEach(walk);
      return;
    }
    if (typeof s === 'object') {
      Object.assign(out, s as Record<string, unknown>);
    }
  };
  walk(style);
  return out;
}

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>{ui}</ThemeProvider>
);

describe('Chip', () => {
  it('renders the label text', () => {
    const { getByText } = render(wrap(<Chip label="Hello" />));
    expect(getByText('Hello')).toBeTruthy();
  });

  it("variant 'badge' renders white text", () => {
    const { getByText } = render(wrap(<Chip label="On Coral" variant="badge" />));
    const text = getByText('On Coral');
    const style = flatten(text.props.style);
    expect(style.color).toBe(defaultTheme.colors.white);
  });

  it.each(['event', 'category', 'highlight'] as const)(
    "variant '%s' renders ink text (not white)",
    (variant) => {
      const { getByText } = render(wrap(<Chip label="Tag" variant={variant} />));
      const text = getByText('Tag');
      const style = flatten(text.props.style);
      expect(style.color).toBe(defaultTheme.colors.peggyInk);
      expect(style.color).not.toBe(defaultTheme.colors.white);
    },
  );

  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      wrap(<Chip label="Tap me" onPress={onPress} />),
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sets accessibilityState.selected when selected={true}', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      wrap(<Chip label="Filter" onPress={onPress} selected={true} />),
    );
    const pressable = getByRole('button');
    expect(pressable.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it('also sets accessibilityState.selected on the non-pressable variant', () => {
    const { getByText } = render(
      wrap(<Chip label="Static" selected={true} />),
    );
    // Walk up to the View ancestor that owns accessibilityState. RN's host
    // <Text> renders an extra host wrapper, so the owning View is two
    // ancestors above the inner text node.
    const text = getByText('Static');
    let node: typeof text | null = text.parent;
    while (node && node.props.accessibilityState === undefined) {
      node = node.parent;
    }
    expect(node?.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it("without onPress, role is 'text' (not 'button')", () => {
    const { getByText, queryByRole } = render(wrap(<Chip label="Static" />));
    // No button should exist when there's no onPress handler.
    expect(queryByRole('button')).toBeNull();

    const text = getByText('Static');
    let node: typeof text | null = text.parent;
    while (node && node.props.accessibilityRole === undefined) {
      node = node.parent;
    }
    expect(node?.props.accessibilityRole).toBe('text');
  });

  it.each(['event', 'category', 'highlight', 'badge'] as const)(
    "selected={true} applies ink border on variant '%s'",
    (variant) => {
      const onPress = jest.fn();
      const { getByRole } = render(
        wrap(
          <Chip label="Filter" variant={variant} onPress={onPress} selected={true} />,
        ),
      );
      const pressable = getByRole('button');
      // Pressable's style is a function — invoke it with a non-pressed state.
      const styleFn = pressable.props.style;
      const resolved =
        typeof styleFn === 'function' ? styleFn({ pressed: false }) : styleFn;
      const flat = flatten(resolved);
      expect(flat.borderColor).toBe(defaultTheme.colors.peggyInk);
      expect(flat.borderWidth).toBe(2);
    },
  );

  it('selected={false} keeps border transparent (no layout shift on toggle)', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      wrap(<Chip label="Filter" onPress={onPress} selected={false} />),
    );
    const pressable = getByRole('button');
    const styleFn = pressable.props.style;
    const resolved =
      typeof styleFn === 'function' ? styleFn({ pressed: false }) : styleFn;
    const flat = flatten(resolved);
    // Border slot is reserved (2dp) but transparent until selected.
    expect(flat.borderWidth).toBe(2);
    expect(flat.borderColor).toBe('transparent');
  });

  it('expands tap area beyond visual bounds via hitSlop', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      wrap(<Chip label="Tap" onPress={onPress} />),
    );
    const pressable = getByRole('button');
    const hitSlop = pressable.props.hitSlop;
    expect(hitSlop).toBeDefined();
    // hitSlop must extend the tap area on every side (>0 px) for a 48dp target.
    expect(hitSlop.top).toBeGreaterThan(0);
    expect(hitSlop.bottom).toBeGreaterThan(0);
    expect(hitSlop.left).toBeGreaterThan(0);
    expect(hitSlop.right).toBeGreaterThan(0);
  });

  it('hitSlop meets minimum thresholds to reach a 48dp tap target', () => {
    // Chip's visual pill is roughly ~28dp tall and label-width wide. To hit
    // the 48dp WCAG/HIG tap-target floor, vertical slop must add >=10dp per
    // side (28 + 20 = 48), and horizontal slop must add >=6dp per side to
    // cover short labels. Tightening below these breaks accessibility.
    const onPress = jest.fn();
    const { getByRole } = render(
      wrap(<Chip label="Tap" onPress={onPress} />),
    );
    const pressable = getByRole('button');
    const hitSlop = pressable.props.hitSlop;
    expect(hitSlop.top).toBeGreaterThanOrEqual(10);
    expect(hitSlop.bottom).toBeGreaterThanOrEqual(10);
    expect(hitSlop.left).toBeGreaterThanOrEqual(6);
    expect(hitSlop.right).toBeGreaterThanOrEqual(6);
  });
});
