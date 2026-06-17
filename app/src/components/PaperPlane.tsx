import React, { useMemo } from 'react';
import Svg, { Path, Polyline } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

/**
 * PaperPlane — small ink-stroke paper plane illustration. Decorative by
 * default; pass an accessibilityLabel to expose it to assistive tech.
 *
 * Spec (peggy-component-spec.md §Illustration): planes are 12–32dp accents,
 * rotated -25..+25°, 60–90% opacity, never recolored. Sizes ≥33dp are
 * "content, not accent" and clamped here.
 *
 * The stroke is hard-coded to peggy ink — the spec forbids recoloring.
 * If you need a non-ink mark, use a different illustration component.
 */

export interface PaperPlaneProps {
  size?: number;
  rotation?: number;
  /** Allow rotations outside the -25..+25° spec band (e.g. 90° for arrows). */
  unclamped?: boolean;
  opacity?: number;
  withTrail?: boolean;
  accessibilityLabel?: string;
}

const VIEWBOX = 48;
const MIN_SIZE = 12;
const MAX_SIZE = 32;
const MIN_OPACITY = 0.6;
const MAX_OPACITY = 0.9;
const MIN_ROTATION = -25;
const MAX_ROTATION = 25;
const DEFAULT_ROTATION = -12;

const PLANE_PATH =
  'M4 24 L44 6 L30 44 L24 28 L4 24 Z M24 28 L44 6';

const TRAIL_POINTS = '4,30 12,28 8,34 16,32 12,38';

export function PaperPlane({
  size = 24,
  rotation = DEFAULT_ROTATION,
  unclamped = false,
  opacity,
  withTrail = false,
  accessibilityLabel,
}: PaperPlaneProps): React.ReactElement {
  const theme = useTheme();

  if (__DEV__) {
    if (size < MIN_SIZE || size > MAX_SIZE) {
      // eslint-disable-next-line no-console
      console.warn(
        `[PaperPlane] size=${size} is outside the 12–32dp accent band (peggy-component-spec.md §Illustration). Clamping.`,
      );
    }
    if (!unclamped && (rotation < MIN_ROTATION || rotation > MAX_ROTATION)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[PaperPlane] rotation=${rotation}° is outside the -25..+25° spec band. Clamping. Pass unclamped to bypass.`,
      );
    }
  }

  const clampedSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, size));
  const stroke = theme.colors.peggyInk;
  const resolvedOpacity = Math.max(
    MIN_OPACITY,
    Math.min(MAX_OPACITY, opacity ?? MAX_OPACITY),
  );
  const resolvedRotation = unclamped
    ? rotation
    : Math.max(MIN_ROTATION, Math.min(MAX_ROTATION, rotation));
  const isDecorative = !accessibilityLabel;

  const transformStyle = useMemo(
    () => ({
      transform: [{ rotate: `${resolvedRotation}deg` }],
      opacity: resolvedOpacity,
    }),
    [resolvedRotation, resolvedOpacity],
  );

  return (
    <Svg
      width={clampedSize}
      height={clampedSize}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      style={transformStyle}
      accessible={!isDecorative}
      accessibilityRole={isDecorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={isDecorative}
      importantForAccessibility={isDecorative ? 'no-hide-descendants' : 'yes'}
    >
      <Path
        d={PLANE_PATH}
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {withTrail ? (
        <Polyline
          points={TRAIL_POINTS}
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="2,3"
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
    </Svg>
  );
}
