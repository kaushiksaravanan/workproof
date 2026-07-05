import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render } from '@testing-library/react-native';

import { MarkerUnderline } from '../MarkerUnderline';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import { colors } from '../../theme/tokens';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

const flattenStyle = (style: unknown) =>
  StyleSheet.flatten(style as any) ?? ({} as Record<string, unknown>);

describe('MarkerUnderline', () => {
  it('renders text content', () => {
    const { getByText } = renderWithTheme(
      <MarkerUnderline text="logged" />,
    );
    expect(getByText('logged')).toBeTruthy();
  });

  it('defaults geometry to theme.typography.h1.fontSize (28) when no style provided', () => {
    const { UNSAFE_getAllByType } = renderWithTheme(
      <MarkerUnderline text="hi" />,
    );
    // The first View is the wrapper, the second is the highlight band.
    const views = UNSAFE_getAllByType(View);
    const highlight = flattenStyle(views[1].props.style);
    const expectedLineHeight = Math.round((typography.h1.fontSize as number) * 1.15);
    const expectedTop = Math.round(expectedLineHeight * 0.62);
    const expectedHeight = Math.max(
      2,
      Math.round(expectedLineHeight * (0.92 - 0.62)),
    );
    expect(highlight.top).toBe(expectedTop);
    expect(highlight.height).toBe(expectedHeight);
    expect(highlight.backgroundColor).toBe(colors.peggyYellow);
    expect(highlight.position).toBe('absolute');
  });

  it('honors a user-provided fontSize override', () => {
    const { UNSAFE_getAllByType } = renderWithTheme(
      <MarkerUnderline text="big" style={{ fontSize: 48 }} />,
    );
    const views = UNSAFE_getAllByType(View);
    const highlight = flattenStyle(views[1].props.style);
    const lineHeight = Math.round(48 * 1.15); // 55
    expect(highlight.top).toBe(Math.round(lineHeight * 0.62));
    expect(highlight.height).toBe(Math.round(lineHeight * (0.92 - 0.62)));
  });

  it('honors a user-provided numeric lineHeight directly', () => {
    const { UNSAFE_getAllByType } = renderWithTheme(
      <MarkerUnderline text="lh" style={{ fontSize: 20, lineHeight: 40 }} />,
    );
    const views = UNSAFE_getAllByType(View);
    const highlight = flattenStyle(views[1].props.style);
    expect(highlight.top).toBe(Math.round(40 * 0.62)); // 25
    expect(highlight.height).toBe(Math.round(40 * (0.92 - 0.62))); // 12
  });

  it('marks highlight band as decorative for assistive tech', () => {
    const { UNSAFE_getAllByType } = renderWithTheme(
      <MarkerUnderline text="a11y" />,
    );
    const views = UNSAFE_getAllByType(View);
    expect(views[1].props.accessibilityElementsHidden).toBe(true);
    expect(views[1].props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
