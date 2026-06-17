import React, { useMemo } from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleSheet } from 'react-native';
import { useSurface } from '../theme/SurfaceContext';

/**
 * Doodle — bitmap illustration (Peggy's mom, family, etc.) anchored in
 * a card or hero corner. Doodles ship as PNGs in src/assets/.
 *
 * Decorative by default; pass an accessibilityLabel to surface meaning to
 * screen readers.
 *
 * Spec rule: doodles are always **ink on white or lavender**, never on blue.
 * Because the bitmap can't recolor itself, we read SurfaceContext (set by
 * Card) and __DEV__-warn if a doodle lands on the hero (peggy-blue) surface.
 */

export type DoodleVariant = 'mom' | 'family' | 'paperPlane';

export interface DoodleProps {
  variant: DoodleVariant;
  size?: number;
  accessibilityLabel?: string;
  style?: ImageStyle;
}

const SOURCES: Record<DoodleVariant, ImageSourcePropType> = {
  mom: require('../assets/peggy-mom-doodle.png'),
  family: require('../assets/peggy-family-doodle.png'),
  paperPlane: require('../assets/peggy-paper-plane.png'),
};

const DEFAULT_SIZE = 96;

export function Doodle({
  variant,
  size = DEFAULT_SIZE,
  accessibilityLabel,
  style,
}: DoodleProps): React.ReactElement {
  const surface = useSurface();
  const isDecorative = !accessibilityLabel;

  if (__DEV__ && surface === 'hero') {
    // eslint-disable-next-line no-console
    console.warn(
      `[Doodle] variant="${variant}" rendered on a peggy-blue hero surface. Doodles must live on white, lavender, or page surfaces (peggy-component-spec.md §Illustration).`,
    );
  }

  const styles = useMemo(
    () => StyleSheet.create({ image: { width: size, height: size } }),
    [size],
  );

  return (
    <Image
      source={SOURCES[variant]}
      style={[styles.image, style]}
      resizeMode="contain"
      accessible={!isDecorative}
      accessibilityRole={isDecorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={isDecorative}
      importantForAccessibility={isDecorative ? 'no-hide-descendants' : 'yes'}
    />
  );
}
