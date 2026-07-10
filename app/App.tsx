import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useAppFonts, colors, defaultTheme } from './src/theme';
import type { RootStackParamList } from './src/navigation/types';
import type { AnchorResult } from './src/types';
import { Onboarding } from './src/screens/Onboarding';
import { Home } from './src/screens/Home';
import { LogWork } from './src/screens/LogWork';
import { ProofDetail } from './src/screens/ProofDetail';
import { History } from './src/screens/History';
import { flushQueue } from './src/services/anchor';
import { useWorkStore } from './src/state/workStore';

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

const Stack = createNativeStackNavigator<RootStackParamList>();

function OnboardingScreen({
  navigation,
}: {
  navigation: {
    replace: (route: keyof RootStackParamList) => void;
  };
}): React.ReactElement {
  return <Onboarding onComplete={() => navigation.replace('Home')} />;
}

function HistoryScreen({
  navigation,
}: {
  navigation: {
    navigate: (route: 'ProofDetail', params: { id: string }) => void;
  };
}): React.ReactElement {
  return (
    <History
      onOpenProof={(record) => navigation.navigate('ProofDetail', { id: record.id })}
    />
  );
}

export default function App(): React.ReactElement {
  const { loaded, error } = useAppFonts();

  useEffect(() => {
    if (!loaded) {
      AccessibilityInfo.announceForAccessibility('Loading WorkProof');
    }
  }, [loaded]);

  // After fonts hydrate, hydrate the work store and try to drain any queued
  // anchor hashes (e.g. records anchored while offline). Re-attempt drain
  // each time the app returns to foreground — a cheap proxy for "network
  // probably reachable" without depending on @react-native-community/netinfo.
  useEffect(() => {
    if (!loaded) return;

    let cancelled = false;

    const drainQueueAndReconcile = async (): Promise<void> => {
      try {
        // Pass a per-hash reconcile callback so flushQueue can update the
        // local record BEFORE removing the hash from the persistent queue.
        // This closes the "anchored on-chain but stuck as queued locally"
        // divergence that would otherwise happen if the OS killed the app
        // between flushQueue returning and the reconcile step running.
        //
        // Note: we call setAnchored directly rather than routing through
        // reconcileAnchoredHashes here. reconcileAnchoredHashes silently
        // swallows per-record setAnchored failures, which is the right
        // behavior for a batch call but the wrong signal for the flushQueue
        // callback (flushQueue needs the throw to keep the hash queued for
        // retry). So we duplicate the queued-record filter here and let
        // errors propagate.
        const reconcile = async (
          hashHex: string,
          result: AnchorResult,
        ): Promise<void> => {
          const records = useWorkStore.getState().records;
          const setAnchored = useWorkStore.getState().setAnchored;
          const queuedRecords = records.filter(
            (r) =>
              r.hash === hashHex && r.anchorTxHash === `queued:${hashHex}`,
          );
          for (const r of queuedRecords) {
            // Let any setAnchored throw propagate — flushQueue will catch it
            // and keep the hash in the queue for a retry.
            await setAnchored(r.id, result.txHash, result.chainId);
          }
        };
        await flushQueue(reconcile);
      } catch {
        // Drain failures are non-fatal; we'll retry next foreground.
      }
    };

    // Initial hydrate + drain.
    void (async () => {
      try {
        await useWorkStore.getState().refresh();
      } catch {
        // refresh() already swallows errors into store state
      }
      if (cancelled) return;
      await drainQueueAndReconcile();
    })();

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void drainQueueAndReconcile();
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
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
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Onboarding"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Home" component={Home} />
            <Stack.Screen
              name="LogWork"
              component={LogWork}
              options={{
                presentation: 'formSheet',
                sheetGrabberVisible: true,
                sheetAllowedDetents: [0.9, 1.0],
                gestureEnabled: true,
              }}
            />
            <Stack.Screen name="ProofDetail" component={ProofDetail} />
            <Stack.Screen name="History" component={HistoryScreen} />
          </Stack.Navigator>
          <StatusBar style="dark" />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
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
