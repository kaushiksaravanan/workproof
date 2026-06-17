import React, { createContext, useContext } from 'react';

/**
 * SurfaceContext — communicates the *visual* surface a child is rendered on.
 * Used by Doodle to dev-warn when placed on a peggy-blue (hero) surface
 * (the spec forbids ink doodles on blue), and by other ink-on-color guards.
 */

export type Surface =
  | 'page'      // peggy page gray
  | 'card'      // white
  | 'lavender'  // peggy lavender
  | 'mint'      // peggy mint
  | 'yellow'    // peggy yellow
  | 'coral'     // peggy coral
  | 'amber'     // peggy amber
  | 'hero'      // peggy blue
  | 'notebook'; // white + rule lines

const SurfaceContext = createContext<Surface>('page');

export function SurfaceProvider({
  surface,
  children,
}: {
  surface: Surface;
  children: React.ReactNode;
}): React.ReactElement {
  return <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>;
}

export function useSurface(): Surface {
  return useContext(SurfaceContext);
}
