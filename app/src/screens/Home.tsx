import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';

import {
  Button,
  Card,
  Chip,
  Doodle,
  MarkerUnderline,
  ScreenScaffold,
} from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useWorkStore } from '../state/workStore';
import type { WorkRecord } from '../types';
import type { RootStackParamList } from '../navigation/types';
import { isAnchored } from '../utils/record';

/**
 * Home — landing screen.
 *
 * Hero band with "Today" marker-underlined headline + Fraunces italic subhead,
 * with the mom doodle anchored to the page-gray surface BELOW the hero
 * (Peggy spec: doodles never live on a peggy-blue surface). Two-up event
 * card stats row, a primary CTA to log a new entry, then up to five recent
 * records each rendered as a tappable standard card showing a 56dp photo
 * thumbnail (with fallback for missing/expired URIs), work type / client
 * name, and a trailing chip flagging anchored vs pending state.
 *
 * Refresh strategy: useFocusEffect re-pulls the store on every navigation
 * focus so a record saved in LogWork is visible the moment the user returns.
 */

export type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HERO_DOODLE_SIZE = 140;
const THUMB_SIZE = 56;
const RECENT_LIMIT = 5;

function countThisWeek(records: WorkRecord[]): number {
  const startOfWeek = dayjs().startOf('week');
  return records.filter((r) => {
    const t = dayjs(r.createdAt);
    return t.isValid() && (t.isSame(startOfWeek) || t.isAfter(startOfWeek));
  }).length;
}

function countAnchored(records: WorkRecord[]): number {
  return records.filter(isAnchored).length;
}

// Exported for unit testing — these are pure and don't need the screen-level
// mocks Home.test.tsx pulls in.
export { countThisWeek, countAnchored };

export function Home({ navigation }: HomeProps): React.ReactElement {
  const theme = useTheme();
  const records = useWorkStore((s) => s.records);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh on every focus, not just mount — newly-saved records from
  // LogWork must appear when the user navigates back.
  useFocusEffect(
    useCallback(() => {
      void useWorkStore.getState().refresh();
    }, []),
  );

  // Pull-to-refresh: HIG Refresh Content Controls. Re-pulls the store and
  // toggles the spinner state so the platform indicator dismisses on completion.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await useWorkStore.getState().refresh();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const recent = useMemo(() => records.slice(0, RECENT_LIMIT), [records]);
  const weekCount = useMemo(() => countThisWeek(records), [records]);
  const anchoredCount = useMemo(() => countAnchored(records), [records]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        heroInner: {
          paddingVertical: theme.spacing.lg,
          minHeight: 96,
          justifyContent: 'center',
        },
        heroHeadline: {
          ...theme.typography.display,
          color: theme.colors.peggyInk,
        },
        heroSubhead: {
          ...theme.typography.serifItalic,
          color: theme.colors.peggyInk,
          marginTop: theme.spacing.sm,
        },
        // Doodle now lives BELOW the hero on page-gray, not on peggy-blue.
        // Peggy spec forbids ink doodles on the blue surface.
        doodleStrip: {
          alignItems: 'flex-end',
          marginTop: -HERO_DOODLE_SIZE / 2,
          marginBottom: theme.spacing.base,
          paddingRight: theme.spacing.base,
        },
        statsRow: {
          flexDirection: 'row',
          gap: theme.spacing.base,
          marginBottom: theme.spacing.lg,
        },
        statCard: {
          flex: 1,
        },
        statValue: {
          ...theme.typography.display,
          color: theme.colors.peggyInk,
        },
        statLabel: {
          ...theme.typography.sectionLabel,
          color: theme.colors.peggyInk,
          marginTop: theme.spacing.xs,
        },
        cta: {
          marginBottom: theme.spacing.lg,
        },
        sectionLabel: {
          ...theme.typography.sectionLabel,
          color: theme.colors.peggyInk,
          marginBottom: theme.spacing.sm,
        },
        sectionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.sm,
        },
        viewAll: {
          ...theme.typography.label,
          color: theme.colors.peggyBlue,
          textDecorationLine: 'underline',
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          minHeight: theme.tapTargets.min,
          textAlignVertical: 'center',
        },
        recentCard: {
          marginBottom: theme.spacing.sm,
        },
        recentRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        thumb: {
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.peggyLavender,
        },
        thumbPlaceholder: {
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.peggyLavender,
          alignItems: 'center',
          justifyContent: 'center',
        },
        recentText: {
          flex: 1,
          marginHorizontal: theme.spacing.md,
        },
        recentTitle: {
          ...theme.typography.title,
          color: theme.colors.peggyInk,
        },
        recentSubtitle: {
          ...theme.typography.body,
          color: theme.colors.mutedForeground,
          marginTop: 2,
        },
        emptyInner: {
          alignItems: 'center',
          paddingVertical: theme.spacing.lg,
        },
        emptyDoodle: {
          marginBottom: theme.spacing.base,
        },
        emptyText: {
          ...theme.typography.serifItalic,
          color: theme.colors.peggyInk,
          textAlign: 'center',
          marginBottom: theme.spacing.lg,
        },
        // Hide chip from AT — Card's accessibilityLabel already includes status.
      }),
    [theme],
  );

  const hero = (
    <Card
      variant="hero"
      accessibilityRole="header"
      accessibilityLabel="Today — your work, on the record"
    >
      <View style={styles.heroInner}>
        <MarkerUnderline text="Today" style={styles.heroHeadline} />
        <Text style={styles.heroSubhead}>your work, on the record</Text>
      </View>
    </Card>
  );

  const goLog = (): void => {
    navigation.navigate('LogWork');
  };

  const isEmpty = recent.length === 0;

  return (
    <ScreenScaffold
      hero={hero}
      testID="home-screen"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.peggyInk}
        />
      }
    >
      {/* Mom doodle peeks up out of the hero onto the page-gray surface. */}
      <View style={styles.doodleStrip} importantForAccessibility="no-hide-descendants">
        <Doodle variant="mom" size={HERO_DOODLE_SIZE} />
      </View>

      <View
        style={styles.statsRow}
        accessible
        accessibilityLabel={`${weekCount} jobs this week, ${anchoredCount} anchored on-chain`}
      >
        <View
          style={styles.statCard}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Card variant="event" style={styles.statCard}>
            <Text
              style={styles.statValue}
              importantForAccessibility="no-hide-descendants"
            >
              {weekCount}
            </Text>
            <Text
              style={styles.statLabel}
              importantForAccessibility="no-hide-descendants"
            >
              this week
            </Text>
          </Card>
        </View>
        <View
          style={styles.statCard}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Card variant="event" style={styles.statCard}>
            <Text
              style={styles.statValue}
              importantForAccessibility="no-hide-descendants"
            >
              {anchoredCount}
            </Text>
            <Text
              style={styles.statLabel}
              importantForAccessibility="no-hide-descendants"
            >
              anchored on-chain
            </Text>
          </Card>
        </View>
      </View>

      {/* Single primary CTA at the top. The empty state owns the duplicate copy
          when there are no records, so we don't read "Log today's work" twice. */}
      {!isEmpty ? (
        <Button
          label="Log today's work"
          onPress={goLog}
          variant="primary"
          style={styles.cta}
        />
      ) : null}

      {!isEmpty ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Recent</Text>
            <Pressable
              onPress={() => navigation.navigate('History')}
              hitSlop={12}
              accessibilityRole="link"
              accessibilityLabel="View all your work"
              accessibilityHint="Opens the full filterable list of saved proofs"
            >
              <Text
                style={styles.viewAll}
                importantForAccessibility="no-hide-descendants"
              >
                View all
              </Text>
            </Pressable>
          </View>
          {recent.map((rec) => {
            const anchored = isAnchored(rec);
            return (
              <Card
                key={rec.id}
                variant="standard"
                onPress={() => navigation.navigate('ProofDetail', { id: rec.id })}
                accessibilityLabel={`${rec.workType}${
                  rec.clientName ? ` for ${rec.clientName}` : ''
                }, ${anchored ? 'anchored on-chain' : 'pending'}`}
                accessibilityHint="Opens proof detail"
                style={styles.recentCard}
              >
                <View style={styles.recentRow}>
                  {rec.photoUri ? (
                    <Image
                      source={{ uri: rec.photoUri }}
                      style={styles.thumb}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View
                      style={styles.thumbPlaceholder}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                  )}
                  <View style={styles.recentText}>
                    <Text style={styles.recentTitle} numberOfLines={2}>
                      {rec.workType}
                    </Text>
                    {rec.clientName ? (
                      <Text style={styles.recentSubtitle} numberOfLines={2}>
                        {rec.clientName}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <Chip
                      label={anchored ? 'anchored' : 'pending'}
                      variant={anchored ? 'badge' : 'category'}
                    />
                  </View>
                </View>
              </Card>
            );
          })}
        </>
      ) : (
        <Card variant="standard">
          <View style={styles.emptyInner}>
            <Doodle
              variant="family"
              size={120}
              style={styles.emptyDoodle}
            />
            <Text style={styles.emptyText}>
              your first proof is one tap away
            </Text>
            <Button
              label="Start your first proof"
              onPress={goLog}
              variant="primary"
            />
          </View>
        </Card>
      )}
    </ScreenScaffold>
  );
}
