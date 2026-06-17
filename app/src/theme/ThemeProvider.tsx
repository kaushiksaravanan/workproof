import React, { createContext, useContext, useMemo } from 'react';
import { colors, spacing, radii, shadows, motion, opacities, tapTargets } from './tokens';
import { typography, fontFamilies } from './typography';

/**
 * ThemeProvider — exposes the full Peggy token system through Context.
 * Tokens are static for now; the provider is the seam to add light/dark or
 * user-scaled type later without reworking consumers.
 */

export interface Theme {
  colors: typeof colors;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  motion: typeof motion;
  opacities: typeof opacities;
  tapTargets: typeof tapTargets;
  typography: typeof typography;
  fontFamilies: typeof fontFamilies;
}

export const defaultTheme: Theme = {
  colors,
  spacing,
  radii,
  shadows,
  motion,
  opacities,
  tapTargets,
  typography,
  fontFamilies,
};

const ThemeContext = createContext<Theme>(defaultTheme);

export interface ThemeProviderProps {
  children: React.ReactNode;
  theme?: Theme;
}

export function ThemeProvider({ children, theme }: ThemeProviderProps): React.ReactElement {
  const value = useMemo<Theme>(() => theme ?? defaultTheme, [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
