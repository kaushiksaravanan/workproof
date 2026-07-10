import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import type { AVPlaybackStatus } from 'expo-av';

import {
  Button,
  Card,
  Chip,
  ScreenScaffold,
} from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useWorkStore } from '../state/workStore';
import { anchorHash, explorerUrl } from '../services/anchor';
import { generateProofPdf, shareProofPdf } from '../services/proof';
import type { RootStackParamList } from '../navigation/types';
import type { WorkRecord } from '../types';
import { isAnchored, isQueuedAnchor, chunkHash, QUEUED_TX_PREFIX } from '../utils/record';

/**
 * ProofDetail — full read of a single saved WorkRecord.
 *
 * Sections (vertical, each in a Card variant):
 *   1. Photo (standard)        — full-width 16:9 hero image
 *   2. Audio (event)           — expo-av playback if record.audioUri present
 *   3. Transcript (notebook)   — 24-line-height ink text on rule lines
 *   4. Extracted fields (event)— 2-col grid of canonical fields
 *   5. Hash & chain (standard) — chunked SHA-256 + anchored chip / explorer
 *   6. Actions row             — share PDF, anchor, delete
 *
 * We subscribe to records via a Zustand selector so anchor / delete updates
 * re-render this screen automatically. Async actions push status strings
 * through AccessibilityInfo.announceForAccessibility for screen-reader users.
 */

export type ProofDetailProps = NativeStackScreenProps<
  RootStackParamList,
  'ProofDetail'
>;

function formatAmount(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatField(value: string | number | undefined): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'number') return formatAmount(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '—';
}

function isQueuedTx(txHash: string): boolean {
  return txHash.startsWith(QUEUED_TX_PREFIX);
}

interface AudioPlayerProps {
  uri: string;
}

function AudioPlayer({ uri }: AudioPlayerProps): React.ReactElement {
  const theme = useTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  useEffect(() => {
    let cancelled = false;
    let local: Audio.Sound | null = null;

    (async () => {
      try {
        // Configure audio mode so iOS silent-switch doesn't mute playback and
        // Android routes through the loudspeaker; safe to call multiple times.
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { sound: created } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          (status: AVPlaybackStatus) => {
            if (cancelled) return;
            if (!status.isLoaded) return;
            setIsPlaying(status.isPlaying);
            const dur = status.durationMillis ?? 0;
            const pos = status.positionMillis ?? 0;
            setProgress(dur > 0 ? Math.min(1, pos / dur) : 0);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setProgress(0);
            }
          },
        );
        if (cancelled) {
          await created.unloadAsync();
          return;
        }
        local = created;
        setSound(created);
      } catch {
        if (!cancelled) {
          AccessibilityInfo.announceForAccessibility('Audio failed to load');
        }
        // ignore — leaves the player disabled
      }
    })();

    return () => {
      cancelled = true;
      if (local) {
        // Detach the status callback synchronously before unloadAsync resolves
        // so a late status tick can't push state on the unmounted component.
        local.setOnPlaybackStatusUpdate(null);
        // Fire-and-forget the async unload — cleanup functions can't be async.
        // Swallow rejections: a failing unload never breaks the caller (React
        // will discard the component anyway), and an unhandled rejection here
        // would surface as a red-box warning in dev.
        local.unloadAsync().catch(() => {
          /* no-op */
        });
      }
    };
  }, [uri]);

  const onToggle = async (): Promise<void> => {
    if (!sound) return;
    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;
      if (status.isPlaying) {
        await sound.pauseAsync();
        AccessibilityInfo.announceForAccessibility('Audio paused');
      } else {
        if (status.didJustFinish || progress >= 1) {
          await sound.setPositionAsync(0);
        }
        await sound.playAsync();
        AccessibilityInfo.announceForAccessibility('Audio playing');
      }
    } catch {
      // swallow — UI state will reconcile via the status callback
    }
  };

  // Static styles — only `progress` drives the fill width, applied inline.
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        toggle: {
          flexDirection: 'row',
          minWidth: theme.tapTargets.min,
          height: theme.tapTargets.min,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.peggyBlue,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
        },
        toggleDisabled: { opacity: 0.4 },
        toggleLabel: {
          ...theme.typography.label,
          color: theme.colors.peggyInk,
        },
        audioCtaLabel: {
          ...theme.typography.label,
          color: theme.colors.peggyInk,
          marginLeft: theme.spacing.xs,
        },
        track: {
          flex: 1,
          height: 6,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.peggyLavender,
          overflow: 'hidden',
        },
        fill: {
          height: 6,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.peggyInk,
        },
        progressText: {
          ...theme.typography.caption,
          color: theme.colors.peggyInk,
          marginLeft: theme.spacing.md,
          minWidth: 40,
          textAlign: 'right',
        },
      }),
    [theme],
  );

  const progressPct = Math.round(progress * 100);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
        accessibilityHint={
          isPlaying ? 'Pauses playback' : 'Plays the voice note'
        }
        accessibilityState={{ disabled: !sound }}
        style={[styles.toggle, !sound && styles.toggleDisabled]}
      >
        <Text style={styles.toggleLabel}>{isPlaying ? '❚❚' : '▶'}</Text>
        <Text style={styles.audioCtaLabel}>
          {isPlaying ? 'Pause' : 'Play'}
        </Text>
      </Pressable>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel="Audio progress"
        accessibilityValue={{ min: 0, max: 100, now: progressPct }}
      >
        <View style={[styles.fill, { width: `${progressPct}%` }]} />
      </View>
      <Text style={styles.progressText}>{progressPct}%</Text>
    </View>
  );
}

function NotFoundScreen({
  onBack,
}: {
  onBack: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: {
          ...theme.typography.h2,
          color: theme.colors.peggyInk,
          marginBottom: theme.spacing.sm,
        },
        body: {
          ...theme.typography.body,
          color: theme.colors.mutedForeground,
          marginBottom: theme.spacing.lg,
        },
      }),
    [theme],
  );

  return (
    <ScreenScaffold testID="proof-detail-not-found">
      <Card variant="standard">
        <Text style={styles.title}>Proof not found</Text>
        <Text style={styles.body}>
          This receipt may have been deleted or never reached this device.
        </Text>
        <Button label="Back" onPress={onBack} variant="secondary" />
      </Card>
    </ScreenScaffold>
  );
}

export function ProofDetail({
  route,
  navigation,
}: ProofDetailProps): React.ReactElement {
  const theme = useTheme();
  const id = route.params.id;

  // Subscribe to records so anchor / delete updates flow back into render.
  const records = useWorkStore((s) => s.records);
  const setAnchored = useWorkStore((s) => s.setAnchored);
  const remove = useWorkStore((s) => s.remove);

  const record: WorkRecord | undefined = useMemo(
    () => records.find((r) => r.id === id),
    [records, id],
  );

  const [anchoring, setAnchoring] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Ref guards close the React-state-async-gap on rapid double taps. setSharing
  // / setAnchoring only flip on the next render, so two taps inside one frame
  // both pass the state-based guard. Worse case: the chain anchor submits twice
  // with the same nonce (one tx reverts; both consume nonce slots).
  const sharingRef = useRef(false);
  const anchoringRef = useRef(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginBottom: theme.spacing.base,
        },
        sectionTitle: {
          ...theme.typography.sectionLabel,
          color: theme.colors.peggyInk,
          marginBottom: theme.spacing.sm,
        },
        photo: {
          width: '100%',
          aspectRatio: 16 / 9,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.hairline,
        },
        photoPlaceholder: {
          width: '100%',
          aspectRatio: 16 / 9,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.hairline,
          alignItems: 'center',
          justifyContent: 'center',
        },
        photoPlaceholderText: {
          ...theme.typography.label,
          color: theme.colors.mutedForeground,
        },
        transcript: {
          ...theme.typography.body,
          color: theme.colors.peggyInk,
        },
        fieldsGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
        },
        fieldCell: {
          width: '50%',
          paddingVertical: theme.spacing.sm,
          paddingRight: theme.spacing.sm,
        },
        fieldLabel: {
          ...theme.typography.formLabel,
          color: theme.colors.peggyInk,
          marginBottom: theme.spacing.xs,
        },
        fieldValue: {
          ...theme.typography.body,
          fontFamily: theme.fontFamilies.sansMedium,
          color: theme.colors.peggyInk,
        },
        hashWrap: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginBottom: theme.spacing.md,
        },
        hashChunk: {
          fontFamily: Platform.select({
            ios: 'Courier',
            android: 'monospace',
            default: 'monospace',
          }),
          fontSize: 13,
          color: theme.colors.peggyInk,
          marginRight: theme.spacing.sm,
        },
        chainRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        explorerPress: {
          minHeight: theme.tapTargets.min,
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.sm,
        },
        explorerLink: {
          ...theme.typography.body,
          color: theme.colors.peggyBlue,
          textDecorationLine: 'underline',
        },
        actionsRow: {
          gap: theme.spacing.sm,
        },
      }),
    [theme],
  );

  const onShare = async (): Promise<void> => {
    if (!record) return;
    if (sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    try {
      AccessibilityInfo.announceForAccessibility('Generating proof PDF');
      const doc = await generateProofPdf(record);
      await shareProofPdf(doc.pdfUri);
      AccessibilityInfo.announceForAccessibility('Proof PDF ready to share');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Share failed';
      AccessibilityInfo.announceForAccessibility(`Share failed: ${msg}`);
      Alert.alert('Share failed', msg);
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  };

  const onAnchor = async (): Promise<void> => {
    if (!record) return;
    if (anchoringRef.current) return;
    anchoringRef.current = true;
    setAnchoring(true);
    try {
      AccessibilityInfo.announceForAccessibility('Anchoring proof on-chain');
      const result = await anchorHash(record.hash);
      await setAnchored(record.id, result.txHash, result.chainId);
      const msg = isQueuedTx(result.txHash)
        ? 'Anchor queued — will submit when online'
        : 'Proof anchored on-chain';
      AccessibilityInfo.announceForAccessibility(msg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Anchor failed';
      AccessibilityInfo.announceForAccessibility(`Anchor failed: ${msg}`);
      Alert.alert('Anchor failed', msg);
    } finally {
      anchoringRef.current = false;
      setAnchoring(false);
    }
  };

  const onDelete = (): void => {
    if (!record) return;
    Alert.alert(
      'Delete this proof?',
      'This permanently removes the record from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(record.id);
              AccessibilityInfo.announceForAccessibility('Proof deleted');
              navigation.goBack();
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : 'Delete failed';
              AccessibilityInfo.announceForAccessibility(
                `Delete failed: ${msg}`,
              );
              Alert.alert('Delete failed', msg);
            }
          },
        },
      ],
    );
  };

  if (!record) {
    return <NotFoundScreen onBack={() => navigation.goBack()} />;
  }

  const anchored = isAnchored(record);
  const queued = isQueuedAnchor(record);
  const explorer =
    anchored && record.anchorTxHash
      ? explorerUrl(record.anchorTxHash)
      : '';
  const chainStatusLabel = anchored
    ? 'Anchored on-chain'
    : queued
      ? 'Queued for chain'
      : 'Not yet anchored';

  return (
    <ScreenScaffold testID="proof-detail-screen">
      {/* In-screen Back affordance — header is hidden in App.tsx, so without
          this the only exit is the OS swipe-back gesture / hardware back. */}
      <View style={[styles.section, { alignItems: 'flex-start' }]}>
        <Button
          label="Back"
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          }}
          variant="secondary"
        />
      </View>

      {/* 1. Photo */}
      <View style={styles.section}>
        <Card variant="standard">
          {record.photoUri ? (
            <Image
              source={{ uri: record.photoUri }}
              style={styles.photo}
              accessibilityIgnoresInvertColors
              accessibilityLabel="Work photo"
            />
          ) : (
            <View
              style={styles.photoPlaceholder}
              accessible
              accessibilityLabel="No photo captured for this proof"
            >
              <Text style={styles.photoPlaceholderText}>No photo</Text>
            </View>
          )}
        </Card>
      </View>

      {/* 2. Audio (skipped if no audioUri) */}
      {record.audioUri ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice note</Text>
          <Card variant="event">
            <AudioPlayer uri={record.audioUri} />
          </Card>
        </View>
      ) : null}

      {/* 3. Transcript */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transcript</Text>
        <Card variant="notebook" accessibilityLabel="Transcript">
          <Text style={styles.transcript}>
            {record.transcript && record.transcript.trim().length > 0
              ? record.transcript
              : '—'}
          </Text>
        </Card>
      </View>

      {/* 4. Extracted fields */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <Card variant="event">
          <View style={styles.fieldsGrid}>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Work</Text>
              <Text style={styles.fieldValue} numberOfLines={4} ellipsizeMode="tail">
                {formatField(record.workType)}
              </Text>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Client</Text>
              <Text style={styles.fieldValue} numberOfLines={4} ellipsizeMode="tail">
                {formatField(record.clientName)}
              </Text>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Location</Text>
              <Text style={styles.fieldValue} numberOfLines={4} ellipsizeMode="tail">
                {formatField(record.location)}
              </Text>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Received</Text>
              <Text style={styles.fieldValue} numberOfLines={4} ellipsizeMode="tail">
                {formatAmount(record.amountReceived)}
              </Text>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Pending</Text>
              <Text style={styles.fieldValue} numberOfLines={4} ellipsizeMode="tail">
                {formatAmount(record.amountPending)}
              </Text>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <Text style={styles.fieldValue} numberOfLines={4} ellipsizeMode="tail">{formatField(record.notes)}</Text>
            </View>
          </View>
        </Card>
      </View>

      {/* 5. Hash & chain */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hash & chain</Text>
        <Card variant="standard">
          <View
            style={styles.hashWrap}
            accessible
            accessibilityLabel={`Hash ${record.hash}`}
            // accessible={true} on the parent groups all child Texts into a
            // single AT element. Adding accessibility flags to each chunk
            // (importantForAccessibility / accessibilityElementsHidden) on
            // top of that produces inconsistent SR behavior across iOS/
            // Android — TalkBack on Android then reads each hex chunk
            // separately. Children stay unflagged so the parent wins.
          >
            {chunkHash(record.hash).map((chunk, i) => (
              // selectable enables native long-press → Copy through the OS
              // action menu on both iOS and Android — without pulling in an
              // extra Clipboard dependency. Users can now actually copy the
              // 64-char hash instead of hand-transcribing from the screen.
              <Text key={i} style={styles.hashChunk} selectable>
                {chunk}
              </Text>
            ))}
          </View>
          <View
            style={styles.chainRow}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={chainStatusLabel}
          >
            {anchored ? (
              <>
                <Chip label="ANCHORED" variant="badge" />
                <Pressable
                  onPress={async () => {
                    try {
                      const ok = await Linking.canOpenURL(explorer);
                      if (!ok) {
                        throw new Error('No app can open this link');
                      }
                      await Linking.openURL(explorer);
                    } catch (err) {
                      const msg =
                        err instanceof Error
                          ? err.message
                          : 'Could not open Polygonscan';
                      AccessibilityInfo.announceForAccessibility(msg);
                      Alert.alert('Cannot open Polygonscan', msg);
                    }
                  }}
                  hitSlop={12}
                  accessibilityRole="link"
                  accessibilityLabel="Open transaction on Polygonscan Amoy"
                  accessibilityHint="Opens the transaction in your browser. Leaves Workproof."
                  style={styles.explorerPress}
                >
                  <Text style={styles.explorerLink}>
                    amoy.polygonscan.com
                  </Text>
                </Pressable>
              </>
            ) : queued ? (
              <Chip label="Queued for chain" variant="category" />
            ) : (
              <Chip label="Not yet anchored" variant="category" />
            )}
          </View>
        </Card>
      </View>

      {/* 6. Actions */}
      <View style={[styles.section, styles.actionsRow]}>
        <Button
          label={sharing ? 'Preparing PDF…' : 'Share proof PDF'}
          onPress={onShare}
          variant="primary"
          disabled={sharing}
          busy={sharing}
        />
        {!anchored ? (
          <Button
            label={
              anchoring
                ? 'Anchoring…'
                : queued
                  ? 'Retry anchor'
                  : 'Anchor on-chain'
            }
            onPress={onAnchor}
            variant="secondary"
            disabled={anchoring}
            busy={anchoring}
          />
        ) : null}
        <Button label="Delete" onPress={onDelete} variant="pillCoral" />
      </View>
    </ScreenScaffold>
  );
}
