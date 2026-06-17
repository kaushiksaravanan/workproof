import React, { useMemo } from 'react';
import {
  AccessibilityRole,
  Pressable,
  PressableStateCallbackType,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Chip — pill tag in one of the four Peggy variants.
 *
 * - event: mint background (schedule items)
 * - category: lavender (filter tags)
 * - highlight: yellow (callouts)
 * - badge: coral with white text (status indicators)
 *
 * Coral is the only variant where text is white — contrast 4.51:1 PASSES
 * AA per wcag-accessibility-report.md. All others use ink (PASS on every
 * tested background). Interactive chips reach a 48dp tap target via hitSlop
 * even when the visual pill is shorter, and switch to role='switch' when
 * `selected` is provided.
 */

export type ChipVariant = 'event' | 'category' | 'highlight' | 'badge';

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
}

const CHIP_HITSLOP = { top: 10, bottom: 10, left: 6, right: 6 } as const;

export function Chip({
  label,
  variant = 'event',
  onPress,
  selected,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
}: ChipProps): React.ReactElement {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs + 2,
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          // Reserve 2dp border space so selecting a chip doesn't shift siblings.
          borderWidth: 2,
          borderColor: 'transparent',
        },
        event: { backgroundColor: theme.colors.peggyMint },
        category: { backgroundColor: theme.colors.peggyLavender },
        highlight: { backgroundColor: theme.colors.peggyYellow },
        badge: { backgroundColor: theme.colors.peggyCoral },
        selected: {
          borderColor: theme.colors.peggyInk,
        },
        pressed: { opacity: 0.85 },
        labelInk: { ...theme.typography.caption, color: theme.colors.peggyInk },
        labelOnCoral: { ...theme.typography.caption, color: theme.colors.white },
      }),
    [theme],
  );

  const labelStyle: TextStyle = variant === 'badge' ? styles.labelOnCoral : styles.labelInk;

  if (onPress) {
    // Filter chips are buttons that carry selection state — role='switch'
    // needs accessibilityState={{checked}} which doesn't match the
    // tag/filter mental model. role='button' + accessibilityState.selected
    // is what TalkBack/VoiceOver announce naturally for filter pills.
    const resolvedRole: AccessibilityRole = accessibilityRole ?? 'button';

    const pressableStyle = (state: PressableStateCallbackType): ViewStyle[] => {
      const out: ViewStyle[] = [styles.base, styles[variant]];
      if (selected) out.push(styles.selected);
      if (state.pressed) out.push(styles.pressed);
      if (style) out.push(style);
      return out;
    };

    return (
      <Pressable
        onPress={onPress}
        hitSlop={CHIP_HITSLOP}
        android_ripple={{ color: theme.colors.peggyRipple, borderless: false }}
        accessibilityRole={resolvedRole}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={selected !== undefined ? { selected } : undefined}
        style={pressableStyle}
      >
        <Text style={labelStyle}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.base, styles[variant], selected && styles.selected, style]}
      accessibilityRole={accessibilityRole ?? 'text'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={selected !== undefined ? { selected } : undefined}
    >
      <Text style={labelStyle}>{label}</Text>
    </View>
  );
}
