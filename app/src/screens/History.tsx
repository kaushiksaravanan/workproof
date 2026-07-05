import React, { useCallback, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  Image,
  ListRenderItemInfo,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Card,
  Chip,
  Doodle,
  MarkerUnderline,
  ScreenScaffold,
  SegmentedTabs,
  SegmentedTab,
} from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useWorkStore } from '../state/workStore';
import type { WorkRecord } from '../types';
import { isAnchored, shortHash, formatRecordAmount } from '../utils/record';

/**
 * History — "Your work" list of every saved WorkRecord. Filterable by anchor
 * status, refreshable via pull-to-refresh, and tap-to-open into ProofDetail.
 *
 * - Header: ScreenScaffold with a Fraunces italic subhead and a
 *   MarkerUnderline highlight on "work".
 * - SegmentedTabs (All / Pending / Anchored) drive the filter; the result is
 *   memoized off useWorkStore.records (already sorted newest-first).
 * - Rows: Card variant="standard" — 64x64 photo thumbnail with placeholder
 *   fallback, work-type/client/amount column, trailing badge Chip + 8-char
 *   ellipsized hash. Anchored badge / pending category chip.
 * - Empty states are per-filter doodle + ink copy on a white Card so contrast
 *   passes WCAG AA.
 */

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'anchored', label: 'Anchored' },
] as const satisfies readonly SegmentedTab[];

export type HistoryFilter = (typeof TABS)[number]['key'];

const FILTER_KEYS: readonly HistoryFilter[] = TABS.map((t) => t.key);

function isHistoryFilter(value: string): value is HistoryFilter {
  return (FILTER_KEYS as readonly string[]).includes(value);
}

export interface HistoryProps {
  onOpenProof: (record: WorkRecord) => void;
}

interface EmptyStateCopy {
  title: string;
  body: string;
}

const EMPTY_COPY: Record<HistoryFilter, EmptyStateCopy> = {
  all: {
    title: 'No proofs yet',
    body: 'Record your first job and it lands here, signed and ready.',
  },
  pending: {
    title: 'Nothing pending',
    body: 'Every proof you have made is anchored on-chain.',
  },
  anchored: {
    title: 'Nothing anchored',
    body: 'Save a proof and tap Anchor to put it on-chain.',
  },
};

export function History({ onOpenProof }: HistoryProps): React.ReactElement {
  const theme = useTheme();
  const records = useWorkStore((s) => s.records);
  const loading = useWorkStore((s) => s.loading);
  const hasHydrated = useWorkStore((s) => s.hasHydrated);
  const error = useWorkStore((s) => s.error);
  const clearError = useWorkStore((s) => s.clearError);
  const refresh = useWorkStore((s) => s.refresh);
  const [filter, setFilter] = useState<HistoryFilter>('all');

  const filtered = useMemo<WorkRecord[]>(() => {
    if (filter === 'all') return records;
    if (filter === 'anchored') return records.filter(isAnchored);
    return records.filter((r) => !isAnchored(r));
  }, [records, filter]);

  // Announce dismissal so VoiceOver users get audible confirmation that the
  // (now-removed) live-region banner is gone — the banner's disappearance
  // alone isn't announced.
  const handleDismissError = useCallback((): void => {
    clearError();
    AccessibilityInfo.announceForAccessibility('Error dismissed');
  }, [clearError]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerWrap: {
          marginBottom: theme.spacing.lg,
        },
        title: {
          ...theme.typography.h1,
          color: theme.colors.peggyInk,
        },
        subhead: {
          ...theme.typography.serifItalic,
          color: theme.colors.peggyInk,
          marginTop: theme.spacing.xs,
        },
        tabsWrap: {
          marginBottom: theme.spacing.base,
        },
        errorBanner: {
          backgroundColor: theme.colors.peggyCoral,
          borderRadius: theme.radii.sm,
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
          marginBottom: theme.spacing.base,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        errorBannerText: {
          ...theme.typography.label,
          color: theme.colors.white,
          flex: 1,
        },
        errorBannerDismiss: {
          ...theme.typography.label,
          color: theme.colors.white,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
        },
        listContent: {
          paddingBottom: theme.spacing.xxl,
          flexGrow: 1,
        },
        separator: {
          height: theme.spacing.sm,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        thumb: {
          width: 64,
          height: 64,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.peggyLavender,
          marginRight: theme.spacing.base,
        },
        thumbPlaceholder: {
          width: 64,
          height: 64,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.peggyLavender,
          marginRight: theme.spacing.base,
        },
        bodyCol: {
          flex: 1,
          marginRight: theme.spacing.sm,
        },
        workType: {
          ...theme.typography.title,
          color: theme.colors.peggyInk,
        },
        clientName: {
          ...theme.typography.body,
          color: theme.colors.mutedForeground,
          marginTop: 2,
        },
        amount: {
          ...theme.typography.label,
          color: theme.colors.peggyInk,
          marginTop: theme.spacing.xs,
        },
        trailing: {
          alignItems: 'flex-end',
        },
        hashMono: {
          ...theme.typography.caption,
          color: theme.colors.mutedForeground,
          marginTop: theme.spacing.xs,
          fontFamily: theme.fontFamilies.sansMedium,
          letterSpacing: 0.4,
        },
        emptyCard: {
          alignItems: 'center',
          paddingVertical: theme.spacing.xl,
          paddingHorizontal: theme.spacing.lg,
          marginHorizontal: theme.spacing.base,
        },
        emptyTitle: {
          ...theme.typography.h2,
          color: theme.colors.peggyInk,
          marginTop: theme.spacing.base,
          textAlign: 'center',
        },
        // Use ink (16.87:1 on white) — gray on page-gray fails WCAG AA at 3.66:1.
        emptyBody: {
          ...theme.typography.body,
          color: theme.colors.peggyInk,
          marginTop: theme.spacing.sm,
          textAlign: 'center',
          maxWidth: 280,
        },
      }),
    [theme],
  );

  const renderItem = ({ item }: ListRenderItemInfo<WorkRecord>): React.ReactElement => {
    const anchored = isAnchored(item);
    const chipLabel = anchored ? 'Anchored' : 'Pending';
    const chipVariant = anchored ? 'badge' : 'category';
    const accessibilityLabel =
      `${item.workType || 'Untitled work'}` +
      (item.clientName ? `, ${item.clientName}` : '') +
      `, ${formatRecordAmount(item)}, ${chipLabel}`;

    return (
      <Card
        variant="standard"
        onPress={() => onOpenProof(item)}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens proof detail"
      >
        <View style={styles.row}>
          {item.photoUri ? (
            <Image
              source={{ uri: item.photoUri }}
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
          <View style={styles.bodyCol}>
            <Text style={styles.workType} numberOfLines={2}>
              {item.workType || 'Untitled work'}
            </Text>
            {item.clientName ? (
              <Text style={styles.clientName} numberOfLines={2}>
                {item.clientName}
              </Text>
            ) : null}
            <Text style={styles.amount}>{formatRecordAmount(item)}</Text>
          </View>
          {/* Status + hash already announced by the parent Card's
              accessibilityLabel — hide them from AT to avoid double-reads. */}
          <View
            style={styles.trailing}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Chip label={chipLabel} variant={chipVariant} />
            <Text
              style={styles.hashMono}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {shortHash(item.hash)}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  const renderEmpty = (): React.ReactElement => {
    // Don't flash "No proofs yet" before AsyncStorage has hydrated.
    if (!hasHydrated) {
      return (
        <Card variant="standard" style={styles.emptyCard}>
          <ActivityIndicator size="large" color={theme.colors.peggyInk} />
          <Text style={styles.emptyBody}>Loading your proofs…</Text>
        </Card>
      );
    }
    const copy = EMPTY_COPY[filter];
    return (
      <Card variant="standard" style={styles.emptyCard}>
        <Doodle
          variant={filter === 'anchored' ? 'paperPlane' : 'mom'}
          size={120}
        />
        <Text style={styles.emptyTitle}>{copy.title}</Text>
        <Text style={styles.emptyBody}>{copy.body}</Text>
      </Card>
    );
  };

  return (
    <ScreenScaffold scrollable={false} testID="history-screen">
      <View style={styles.headerWrap}>
        <View
          style={styles.row}
          accessible
          accessibilityRole="header"
          accessibilityLabel="Your work"
        >
          <Text style={styles.title} importantForAccessibility="no-hide-descendants">
            Your{' '}
          </Text>
          <MarkerUnderline text="work" style={styles.title} />
        </View>
        <Text style={styles.subhead}>Every job, signed and saved.</Text>
      </View>
      <View style={styles.tabsWrap}>
        <SegmentedTabs
          tabs={TABS as unknown as SegmentedTab[]}
          value={filter}
          onChange={(key) => {
            if (isHistoryFilter(key)) setFilter(key);
          }}
        />
      </View>
      {error ? (
        <View
          style={styles.errorBanner}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Error: ${error}`}
        >
          <Text style={styles.errorBannerText} numberOfLines={2}>
            {error}
          </Text>
          <Pressable
            onPress={handleDismissError}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error"
          >
            <Text style={styles.errorBannerDismiss}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList<WorkRecord>
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={theme.colors.peggyInk}
            colors={[theme.colors.peggyBlue]}
          />
        }
      />
    </ScreenScaffold>
  );
}
