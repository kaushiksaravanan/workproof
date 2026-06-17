import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  AccessibilityInfo,
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ThemeProvider, useAppFonts, colors, defaultTheme } from './src/theme';
import { TranscriptScreen } from './src/screens/TranscriptScreen';

/**
 * App — root entry. Loads the full Peggy type stack via useAppFonts (the
 * single source of truth) and wraps the tree in ThemeProvider. While fonts
 * hydrate we render an accessible loading splash on the Peggy page color.
 *
 * NOTE: react-native-get-random-values is imported first so any code path
 * that pulls uuid (transitively or directly) sees the polyfill before
 * Math.random gets queried. Expo's main is node_modules/expo/AppEntry.js
 * which evaluates this file before anything else in src/.
 */

export default function App(): React.ReactElement {
  const { loaded, error } = useAppFonts();

  useEffect(() => {
    if (!loaded) {
      AccessibilityInfo.announceForAccessibility('Loading WorkProof');
    }
  }, [loaded]);

  if (!loaded) {
    return (
      <View
        style={styles.splash}
        accessible
        accessibilityLabel="Loading WorkProof"
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator color={colors.peggyInk} />
        <Text style={styles.splashLabel}>Loading WorkProof</Text>
        {error ? (
          <Text style={styles.error}>Font load error: {error.message}</Text>
        ) : null}
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <TranscriptScreen />
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  splashLabel: {
    ...defaultTheme.typography.label,
    color: colors.peggyInk,
    marginTop: 12,
  },
  error: {
    ...defaultTheme.typography.caption,
    color: colors.peggyCoral,
    marginTop: 8,
    textAlign: 'center',
  },
});
