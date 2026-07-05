import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityRole,
  Animated,
  LayoutChangeEvent,
  Pressable,
  PressableStateCallbackType,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Surface, SurfaceProvider } from '../theme/SurfaceContext';
import { useReducedMotion } from '../theme/useReducedMotion';
import { useHaptics } from '../theme/useHaptics';

/**
 * Card — surface variants per peggy-component-spec.md §Cards.
 *
 * - standard: white, 20dp radius, shadow-card
 * - event: lavender, 20dp radius, shadow-soft
 * - hero: peggy-blue full-bleed band (no shadow, no radius). MUST live in the
 *   ScreenScaffold `hero` slot — children should use peggyInk text (never
 *   white-on-blue, FAILS contrast 2.73:1).
 * - notebook: white card with peggyBlue@18% horizontal rule lines every
 *   RULE_GAP dp, a peggyCoral@35% vertical margin line at NOTEBOOK_LEFT_MARGIN,
 *   and a left content inset that aligns text to the right of the margin.
 *   Rule count is computed from measured height so the lines fill the card
 *   regardless of how long the content is.
 *
 * If onPress is set, the card becomes an interactive surface with role=button,
 * a 48dp min tap target on both axes, and a pressed-shadow swap.
 */

export type CardVariant = 'standard' | 'event' | 'hero' | 'notebook';

export interface CardProps {
  variant?: CardVariant;
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
}

export const NOTEBOOK_LEFT_MARGIN = 24;
export const RULE_GAP = 24;
const MARGIN_LINE_OFFSET = 8; // distance from content edge back to coral line
const FIRST_LINE_TOP_INSET = 4; // empirical nudge so first rule sits under text

const VARIANT_TO_SURFACE: Record<CardVariant, Surface> = {
  standard: 'card',
  event: 'lavender',
  hero: 'hero',
  notebook: 'notebook',
};

export function Card({
  variant = 'standard',
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
}: CardProps): React.ReactElement {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const haptics = useHaptics();
  const [notebookHeight, setNotebookHeight] = useState<number>(0);

  // Animated press lift — mirrors Button.tsx. Rests at 0 and dips to
  // theme.motion.pressLiftDp on press-in (the lift idiom shared with
  // Button / RoundRecordButton). Reduced-motion users skip the animation
  // and stay at 0 so they never see the translate.
  const lift = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const animateTo = (toValue: number): void => {
    if (reduceMotion) {
      lift.setValue(0);
      return;
    }
    animationRef.current?.stop();
    const next = Animated.timing(lift, {
      toValue,
      duration: theme.motion.pressSettleMs,
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

  if (__DEV__ && onPress && !accessibilityLabel) {
    // VoiceOver announces interactive cards by their accessibilityLabel; an
    // unlabelled pressable Card surfaces as an unnamed button. Warn early so
    // the omission is caught in dev rather than QA.
    // eslint-disable-next-line no-console
    console.warn('Card with onPress requires accessibilityLabel');
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          borderRadius: theme.radii.md,
          padding: theme.spacing.base,
        },
        standard: {
          backgroundColor: theme.colors.card,
          ...theme.shadows.card,
        },
        event: {
          backgroundColor: theme.colors.peggyLavender,
          ...theme.shadows.soft,
        },
        hero: {
          backgroundColor: theme.colors.peggyBlue,
          borderRadius: 0,
          paddingHorizontal: theme.spacing.lg,
        },
        notebook: {
          backgroundColor: theme.colors.card,
          paddingLeft: theme.spacing.base + NOTEBOOK_LEFT_MARGIN,
          ...theme.shadows.card,
          overflow: 'hidden',
        },
        ruleLayer: {
          ...StyleSheet.absoluteFillObject,
        },
        rule: {
          height: 1,
          backgroundColor: theme.colors.notebookRule,
          marginBottom: RULE_GAP - 1,
        },
        marginLine: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: theme.spacing.base + NOTEBOOK_LEFT_MARGIN - MARGIN_LINE_OFFSET,
          width: 1,
          backgroundColor: theme.colors.notebookMargin,
        },
        rulesContainer: {
          paddingTop: theme.spacing.base + FIRST_LINE_TOP_INSET,
          paddingHorizontal: theme.spacing.base + NOTEBOOK_LEFT_MARGIN,
        },
        pressable: {
          minHeight: theme.tapTargets.min,
          minWidth: theme.tapTargets.min,
        },
        pressed: { opacity: theme.motion.pressOpacity },
        pressedShadow: { ...theme.shadows.soft },
      }),
    [theme],
  );

  const surface = VARIANT_TO_SURFACE[variant];

  const renderNotebookOverlay = (): React.ReactElement | null => {
    if (variant !== 'notebook') return null;
    const ruleCount =
      notebookHeight > 0
        ? Math.ceil(notebookHeight / RULE_GAP) + 1
        : 0;
    const rules: React.ReactElement[] = [];
    for (let i = 0; i < ruleCount; i++) {
      rules.push(<View key={i} style={styles.rule} />);
    }
    return (
      <View
        style={styles.ruleLayer}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.rulesContainer}>{rules}</View>
        <View style={styles.marginLine} />
      </View>
    );
  };

  const onNotebookLayout = (e: LayoutChangeEvent): void => {
    if (variant !== 'notebook') return;
    const h = e.nativeEvent.layout.height;
    if (Math.abs(h - notebookHeight) > 1) setNotebookHeight(h);
  };

  const wrappedChildren = (
    <SurfaceProvider surface={surface}>
      {renderNotebookOverlay()}
      {children}
    </SurfaceProvider>
  );

  if (onPress) {
    const pressableStyle = (state: PressableStateCallbackType): ViewStyle[] => {
      const out: ViewStyle[] = [
        styles.base,
        styles[variant],
        styles.pressable,
      ];
      if (state.pressed) {
        out.push(styles.pressed);
        out.push(styles.pressedShadow);
      }
      if (style) out.push(style);
      return out;
    };

    const handlePress = (): void => {
      // Light impact mirrors Button — confirms the tap registered without
      // the heavier feel of a destructive or primary action.
      haptics.impactLight();
      onPress();
    };

    return (
      <Animated.View style={{ transform: [{ translateY: lift }] }}>
        <Pressable
          onPress={handlePress}
          onPressIn={() => animateTo(theme.motion.pressLiftDp)}
          onPressOut={() => animateTo(0)}
          onLayout={variant === 'notebook' ? onNotebookLayout : undefined}
          android_ripple={{ color: theme.colors.peggyRipple, borderless: false }}
          accessibilityRole={accessibilityRole ?? 'button'}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          style={pressableStyle}
        >
          {wrappedChildren}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View
      style={[styles.base, styles[variant], style]}
      onLayout={variant === 'notebook' ? onNotebookLayout : undefined}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      {wrappedChildren}
    </View>
  );
}
