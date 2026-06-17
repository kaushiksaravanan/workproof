import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityRole,
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../theme/useReducedMotion';

/**
 * SegmentedTabs — lavender pill segmented tabs per peggy-component-spec.md
 * §Tabs lines 128–133.
 *
 * - Container: peggyLavender pill, padding 4
 * - Active tab: white card with shadow-soft and peggyInk text
 * - Inactive tab: transparent + peggyInk at 80% opacity
 * - 150ms ease (cubic-bezier(.25,.1,.25,1)) transition; gated on reduce-motion
 *
 * The indicator is a fixed-width sliding pill, sized from the measured
 * container width (onLayout) to NUMERIC pixel offsets — never percentage
 * strings (RN's native transform.translateX requires a number).
 *
 * Each tab is a 48dp tap target.
 */

export interface SegmentedTab {
  key: string;
  label: string;
  accessibilityLabel?: string;
}

export interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  value: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
  accessibilityRole?: AccessibilityRole;
}

const PILL_PADDING = 4;
const EASE_BEZIER = Easing.bezier(0.25, 0.1, 0.25, 1);

export function SegmentedTabs({
  tabs,
  value,
  onChange,
  style,
  accessibilityRole = 'tablist',
}: SegmentedTabsProps): React.ReactElement {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const tabCount = Math.max(1, tabs.length);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === value),
  );

  // Lazy-init Animated.Value at the current activeIndex so the indicator
  // doesn't flash to index 0 on the first frame when the parent passes a
  // non-zero default.
  const animated = useRef<Animated.Value>(
    new Animated.Value(activeIndex),
  ).current;
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (reduceMotion) {
      animated.setValue(activeIndex);
      return;
    }
    const anim = Animated.timing(animated, {
      toValue: activeIndex,
      duration: theme.motion.hoverLiftMs,
      easing: EASE_BEZIER,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [activeIndex, animated, reduceMotion, theme.motion.hoverLiftMs]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          backgroundColor: theme.colors.peggyLavender,
          borderRadius: theme.radii.pill,
          padding: PILL_PADDING,
        },
        tab: {
          flex: 1,
          minHeight: theme.tapTargets.min,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radii.pill,
        },
        labelActive: {
          ...theme.typography.label,
          color: theme.colors.peggyInk,
        },
        labelInactive: {
          ...theme.typography.label,
          color: theme.colors.peggyInk,
          opacity: 0.8,
        },
        indicator: {
          position: 'absolute',
          top: PILL_PADDING,
          bottom: PILL_PADDING,
          left: PILL_PADDING,
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.pill,
          ...theme.shadows.soft,
        },
      }),
    [theme],
  );

  const innerWidth = Math.max(0, containerWidth - PILL_PADDING * 2);
  const tabWidth = innerWidth / tabCount;

  // Numeric pixel translateX — percentage strings are not valid for
  // transform: [{ translateX: ... }] and silently break native driver.
  const translateX = animated.interpolate({
    inputRange: tabs.map((_, i) => i),
    outputRange: tabs.map((_, i) => tabWidth * i),
  });

  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width;
    if (next !== containerWidth) setContainerWidth(next);
  };

  return (
    <View
      onLayout={onLayout}
      style={[styles.container, style]}
      accessibilityRole={accessibilityRole}
    >
      {innerWidth > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            { width: tabWidth, transform: [{ translateX }] },
          ]}
          pointerEvents="none"
        />
      ) : null}
      {tabs.map((tab) => {
        const isActive = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            android_ripple={{
              color: theme.colors.peggyRipple,
              borderless: false,
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.accessibilityLabel ?? tab.label}
            accessibilityState={{ selected: isActive }}
            style={styles.tab}
          >
            <Text style={isActive ? styles.labelActive : styles.labelInactive}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
