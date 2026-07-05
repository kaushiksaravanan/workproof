import React, { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityRole,
  AccessibilityState,
  Animated,
  Easing,
  Pressable,
  PressableStateCallbackType,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useHaptics } from '../theme/useHaptics';
import { useReducedMotion } from '../theme/useReducedMotion';

/**
 * Button — Peggy primary / secondary / pillAmber / pillCoral variants.
 *
 * - Min tap target 48dp on every variant (height + width).
 * - Press animates translateY back to 0; reduced-motion collapses lift to 0
 *   and skips the timing animation entirely.
 * - Shadow drops to shadow-soft on press, lifts to shadow-card at rest.
 * - All variants use ink (#001A33) for the label — never white-on-blue.
 *   pillAmber labels render in 700/Bold so ink-on-amber qualifies as WCAG
 *   "large text" (3:1 minimum, our pair is 3.89:1 PASS).
 */

export type ButtonVariant = 'primary' | 'secondary' | 'pillAmber' | 'pillCoral';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
}

const REST_LIFT = -2;
// Mirror SegmentedTabs' EASE_BEZIER so press settle rides a HIG curve.
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
}: ButtonProps): React.ReactElement {
  const theme = useTheme();
  const haptics = useHaptics();
  const reduceMotion = useReducedMotion();
  const restLift = reduceMotion ? 0 : REST_LIFT;
  const lift = useRef(new Animated.Value(restLift)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // AccessibilityInfo resolves async, so reduceMotion may flip from its
  // default to true after mount. Re-sync the resting lift so users with
  // Reduce Motion never see the -2dp lift.
  useEffect(() => {
    lift.setValue(restLift);
  }, [lift, restLift]);

  const animateTo = (toValue: number): void => {
    if (reduceMotion) {
      lift.setValue(0);
      return;
    }
    animationRef.current?.stop();
    const next = Animated.timing(lift, {
      toValue,
      duration: theme.motion.pressSettleMs,
      easing: EASE,
      useNativeDriver: true,
    });
    animationRef.current = next;
    next.start(({ finished }) => {
      if (finished && animationRef.current === next) {
        animationRef.current = null;
      }
    });
  };

  useEffect(() => {
    return () => {
      animationRef.current?.stop();
    };
  }, []);

  const isPill = variant === 'pillAmber' || variant === 'pillCoral';

  // Haptic on press: pillCoral (destructive) gets medium impact, all other
  // variants get light. useHaptics() no-ops on non-iOS so this is safe.
  // busy is treated as a soft-disable: taps no-op and haptics stay silent so
  // a tap mid-submit doesn't double-fire onPress or buzz the user.
  const handlePress = (): void => {
    if (disabled || busy) return;
    if (variant === 'pillCoral' || variant === 'pillAmber') {
      haptics.impactMedium();
    } else if (variant === 'secondary') {
      haptics.selection();
    } else {
      haptics.impactLight();
    }
    onPress();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          borderRadius: isPill ? theme.radii.pill : theme.radii.button,
          minHeight: theme.tapTargets.min,
          minWidth: theme.tapTargets.min,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: isPill ? theme.spacing.sm : theme.spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        rest: { ...theme.shadows.card },
        pressedShadow: { ...theme.shadows.soft },
        primary: { backgroundColor: theme.colors.peggyBlue },
        secondary: {
          backgroundColor: theme.colors.card,
          borderWidth: 2,
          borderColor: theme.colors.peggyInk,
        },
        pillAmber: { backgroundColor: theme.colors.peggyAmber },
        pillCoral: { backgroundColor: theme.colors.peggyCoral },
        disabled: { opacity: theme.opacities.disabled },
        pressed: { opacity: 0.85 },
        label: { ...theme.typography.label, color: theme.colors.peggyInk },
        labelAmber: { fontFamily: theme.fontFamilies.sansBold },
      }),
    [isPill, theme],
  );

  const variantStyle = styles[variant];
  const animatedStyle = useMemo(
    () => ({ transform: [{ translateY: lift }] }),
    [lift],
  );

  const pressableStyle = (state: PressableStateCallbackType): ViewStyle[] => {
    const out: ViewStyle[] = [
      styles.base,
      state.pressed ? styles.pressedShadow : styles.rest,
      variantStyle,
    ];
    if (disabled || busy) out.push(styles.disabled);
    if (state.pressed) out.push(styles.pressed);
    return out;
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={handlePress}
        disabled={disabled || busy}
        onPressIn={() => animateTo(0)}
        onPressOut={() => animateTo(restLift)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        android_ripple={{ color: theme.colors.peggyRipple, borderless: false }}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, busy, ...accessibilityState }}
        style={pressableStyle}
      >
        <Text
          style={[styles.label, variant === 'pillAmber' && styles.labelAmber]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
