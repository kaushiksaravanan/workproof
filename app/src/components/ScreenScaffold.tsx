import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/ThemeProvider';

/**
 * ScreenScaffold — page chrome that every screen wraps in.
 *
 * - Page-gray background (Peggy --background = #E3E3E3)
 * - SafeAreaView so content respects notch / nav insets
 * - Optional `hero` slot rendered edge-to-edge above the content (use a Card
 *   variant="hero" for the cornflower band)
 * - Content area is scrollable by default; pass `scrollable={false}` for
 *   fixed-height screens (camera, full-screen modals).
 *
 * Padding lives on ScrollView's contentContainerStyle so scroll bounds always
 * include the bottom inset, even when content is shorter than the viewport.
 */

export interface ScreenScaffoldProps {
  children: React.ReactNode;
  hero?: React.ReactNode;
  scrollable?: boolean;
  contentStyle?: ViewStyle;
  testID?: string;
}

export function ScreenScaffold({
  children,
  hero,
  scrollable = true,
  contentStyle,
  testID,
}: ScreenScaffoldProps): React.ReactElement {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        content: {
          paddingHorizontal: theme.spacing.base,
          paddingTop: theme.spacing.base,
          paddingBottom: theme.spacing.xxl,
          flexGrow: 1,
        },
        heroSlot: {
          marginBottom: theme.spacing.base,
        },
      }),
    [theme],
  );

  return (
    <SafeAreaView style={styles.safe} testID={testID}>
      <StatusBar style="dark" />
      {hero ? <View style={styles.heroSlot}>{hero}</View> : null}
      {scrollable ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
