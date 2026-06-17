import React, { useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * MarkerUnderline — yellow highlighter band painted across the lower 30% of
 * the text baseline, mirroring the `.marker-underline` utility in the Peggy
 * web export (peggy-export/web-src/styles.css ~L164):
 *
 *     background-image: linear-gradient(transparent 62%, peggyYellow 62%,
 *                                       peggyYellow 92%, transparent 92%);
 *
 * The yellow rect is decorative (silenced for assistive tech); the text is
 * exposed via the standard <Text> child. RN already reads the text node, so
 * we only override accessibilityLabel when explicitly provided.
 */

export interface MarkerUnderlineProps {
  text: string;
  style?: TextStyle;
  accessibilityLabel?: string;
}

const HIGHLIGHT_TOP_FRACTION = 0.62; // matches the web 62%→92% band
const HIGHLIGHT_BOTTOM_FRACTION = 0.92;
const DEFAULT_FONT_SIZE = 28;

export function MarkerUnderline({
  text,
  style,
  accessibilityLabel,
}: MarkerUnderlineProps): React.ReactElement {
  const theme = useTheme();
  const fontSize: number =
    typeof style?.fontSize === 'number'
      ? style.fontSize
      : (theme.typography.h1.fontSize as number | undefined) ?? DEFAULT_FONT_SIZE;
  const lineHeight: number =
    typeof style?.lineHeight === 'number'
      ? style.lineHeight
      : Math.round(fontSize * 1.15);
  const top = Math.round(lineHeight * HIGHLIGHT_TOP_FRACTION);
  const height = Math.max(
    2,
    Math.round(lineHeight * (HIGHLIGHT_BOTTOM_FRACTION - HIGHLIGHT_TOP_FRACTION)),
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          alignSelf: 'flex-start',
          position: 'relative',
        },
        highlight: {
          position: 'absolute',
          left: 0,
          right: 0,
          top,
          height,
          backgroundColor: theme.colors.peggyYellow,
          borderRadius: 0,
        },
        text: {
          color: theme.colors.peggyInk,
        },
      }),
    [theme, top, height],
  );

  return (
    <View style={styles.wrapper}>
      <View
        style={styles.highlight}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
      <Text
        style={[styles.text, style]}
        accessibilityLabel={accessibilityLabel}
      >
        {text}
      </Text>
    </View>
  );
}
