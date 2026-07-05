import { TextStyle } from 'react-native';

/**
 * Peggy typography scale — ported from peggy-export/android/Type.kt.
 * Font families match the keys returned by @expo-google-fonts hooks (see fonts.ts).
 *
 * Tokens are mapped to Apple HIG built-in text styles (see JSDoc on each token):
 *   display → LargeTitle, h1 → Title1, h2 → Title2, headline → Headline,
 *   body → Subhead (one step below HIG Body — intentional brand choice),
 *   label → Footnote, caption / formLabel → Caption.
 *
 * IMPORTANT: lineHeight is pinned in pt. At AX3+ Dynamic Type sizes the
 * size:lineHeight ratio collapses. Do NOT hard-override lineHeight in
 * consumers — let the token propagate. A runtime scaler in ThemeProvider
 * (PixelRatio.getFontScale()) is the proper fix and is tracked separately.
 */

export const fontFamilies = {
  sansRegular: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  sansExtraBold: 'PlusJakartaSans_800ExtraBold',
  serifItalicMedium: 'Fraunces_500Medium_Italic',
  serifItalicBold: 'Fraunces_700Bold_Italic',
} as const;

export type FontFamilyToken = keyof typeof fontFamilies;

export const typography = {
  /** HIG: LargeTitle (34pt). Brand letterSpacing kept tight for marketing hero. */
  display: {
    fontFamily: fontFamilies.sansExtraBold,
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: -0.68,
  } satisfies TextStyle,
  /** HIG: Title1 (28pt). */
  h1: {
    fontFamily: fontFamilies.sansExtraBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
  } satisfies TextStyle,
  /** HIG: Title2 (22pt). */
  h2: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
  } satisfies TextStyle,
  /** HIG: Headline (17pt SemiBold). */
  headline: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
  } satisfies TextStyle,
  /**
   * @deprecated Use `headline` — this token has Headline 17 SemiBold semantics,
   * not Title* semantics. Kept as an alias to avoid a breaking rename across screens.
   */
  title: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
  } satisfies TextStyle,
  /** HIG: Subhead (15pt) — one step below HIG Body 17pt; intentional brand choice. */
  body: {
    fontFamily: fontFamilies.sansRegular,
    fontSize: 15,
    lineHeight: 20,
  } satisfies TextStyle,
  /** HIG: Footnote (13pt → 14pt SemiBold here for stronger label weight). */
  label: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 14,
    lineHeight: 18,
  } satisfies TextStyle,
  /**
   * Section heading for non-form contexts (Home.sectionLabel, Home.statLabel,
   * ProofDetail.sectionTitle). Regular case, no positive tracking — use this
   * instead of `formLabel` for headings to avoid all-caps in sustained reading.
   */
  sectionLabel: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
  } satisfies TextStyle,
  /** HIG: Caption1 (12pt). */
  caption: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
  } satisfies TextStyle,
  /** HIG: Caption1 (12pt) — uppercase variant for actual form field labels only. */
  formLabel: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  serifItalic: {
    fontFamily: fontFamilies.serifItalicMedium,
    fontSize: 22,
    // 22 * 1.2 = 26.4 — round up to 27 to satisfy the AA min ratio.
    lineHeight: 27,
    letterSpacing: -0.22,
    fontStyle: 'italic',
  } satisfies TextStyle,
} as const;

export type TypographyToken = keyof typeof typography;
