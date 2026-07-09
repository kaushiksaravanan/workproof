/**
 * Barrel exports for the theme layer. Pins the exported symbol set so
 * accidental removals surface as failing tests, not silent breakage.
 */

import * as Theme from '../index';

describe('src/theme/index.ts — barrel exports', () => {
  it.each([
    // Tokens
    'colors',
    'spacing',
    'radii',
    'shadows',
    'shadowTint',
    'motion',
    'opacities',
    'tapTargets',
    // Typography
    'typography',
    'fontFamilies',
    // Fonts
    'useAppFonts',
    // ThemeProvider
    'ThemeProvider',
    'useTheme',
    'defaultTheme',
    // Motion / haptics hooks
    'useReducedMotion',
    'useHaptics',
    // Surface context
    'SurfaceProvider',
    'useSurface',
  ])("exports '%s' as a truthy value", (name) => {
    expect((Theme as Record<string, unknown>)[name]).toBeDefined();
    expect((Theme as Record<string, unknown>)[name]).not.toBeNull();
  });

  it('exports the exact expected set (no accidental additions)', () => {
    const expected = [
      'ThemeProvider',
      'SurfaceProvider',
      'colors',
      'defaultTheme',
      'fontFamilies',
      'motion',
      'opacities',
      'radii',
      'shadowTint',
      'shadows',
      'spacing',
      'tapTargets',
      'typography',
      'useAppFonts',
      'useHaptics',
      'useReducedMotion',
      'useSurface',
      'useTheme',
    ].sort();
    const actual = Object.keys(Theme).sort();
    expect(actual).toEqual(expected);
  });
});
