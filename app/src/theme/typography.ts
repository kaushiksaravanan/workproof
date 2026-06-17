import { TextStyle } from 'react-native';

/**
 * Peggy typography scale — ported from peggy-export/android/Type.kt.
 * Font families match the keys returned by @expo-google-fonts hooks (see fonts.ts).
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
  display: {
    fontFamily: fontFamilies.sansExtraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.68,
  } satisfies TextStyle,
  h1: {
    fontFamily: fontFamilies.sansExtraBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
  } satisfies TextStyle,
  h2: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.22,
  } satisfies TextStyle,
  title: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
  } satisfies TextStyle,
  body: {
    fontFamily: fontFamilies.sansRegular,
    fontSize: 15,
    lineHeight: 20,
  } satisfies TextStyle,
  label: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 14,
    lineHeight: 18,
  } satisfies TextStyle,
  caption: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
  } satisfies TextStyle,
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
    lineHeight: 26,
    letterSpacing: -0.22,
    fontStyle: 'italic',
  } satisfies TextStyle,
} as const;

export type TypographyToken = keyof typeof typography;
