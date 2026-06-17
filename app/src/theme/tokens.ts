import { Platform, ViewStyle } from 'react-native';

/**
 * Peggy design tokens — ported 1:1 from peggy-export/android/Color.kt and
 * peggy-export/design-tokens/tokens.css. Hex values only (no oklch).
 */

export const colors = {
  // Brand
  peggyBlue: '#7DA1FF',
  peggyLavender: '#CAD9F6',
  peggyInk: '#001A33',
  peggyYellow: '#FFD84D',
  peggyCoral: '#F0445B',
  peggyMint: '#C9EFC3',
  peggyAmber: '#BD814B',

  // Neutrals
  gray: '#6B7280',
  hairline: '#E5E7EB',
  page: '#E3E3E3',
  white: '#FFFFFF',

  // Semantic aliases
  background: '#E3E3E3',
  foreground: '#001A33',
  card: '#FFFFFF',
  border: '#E5E7EB',
  mutedForeground: '#6B7280',

  // Interaction — soft ink wash for Android ripple + pressed-state tints
  peggyRipple: 'rgba(0, 26, 51, 0.12)',
  peggyPressTint: 'rgba(0, 26, 51, 0.06)',

  // Notebook variant — peggyBlue@18% rule lines + peggyCoral@35% margin
  // (peggy-export/web-src/index.tsx ~L274 — canonical notepaper).
  notebookRule: 'rgba(125, 161, 255, 0.18)',
  notebookMargin: 'rgba(240, 68, 91, 0.35)',
} as const;

export type ColorToken = keyof typeof colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;

export const radii = {
  sm: 12,
  md: 20,
  lg: 28,
  xl: 32,
  button: 14,
  pill: 9999,
} as const;

export type RadiusToken = keyof typeof radii;

export const tapTargets = {
  min: 48,
  pill: 48,
} as const;

/** shadowTint — desaturated navy approximating oklch(0.2 0.08 268). */
export const shadowTint = '#1A2548';

type Shadow = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

const shadow = (
  elevation: number,
  shadowOpacity: number,
  shadowRadius: number,
  offsetY: number,
): Shadow =>
  Platform.select<Shadow>({
    ios: {
      shadowColor: shadowTint,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity,
      shadowRadius,
    },
    default: { elevation },
  }) as Shadow;

export const shadows = {
  soft: shadow(2, 0.06, 12, 4),
  card: shadow(4, 0.1, 24, 8),
  pressed: shadow(8, 0.14, 36, 16),
} as const;

export type ShadowToken = keyof typeof shadows;

export const motion = {
  hoverLiftMs: 150,
  pressSettleMs: 80,
  markerDrawMs: 250,
  cardEnterMs: 200,
  planeSwooshMs: 400,
  hoverLiftDp: -2,
  cardLiftDp: -4,
} as const;

export const opacities = {
  disabled: 0.5,
  placeholder: 0.6,
} as const;
