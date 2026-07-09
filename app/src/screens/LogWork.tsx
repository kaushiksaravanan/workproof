import 'react-native-get-random-values';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  PressableStateCallbackType,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { v4 as uuidv4 } from 'uuid';

import {
  Button,
  Card,
  Doodle,
  PaperPlane,
  ScreenScaffold,
} from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../theme/useReducedMotion';
import { useWorkStore } from '../state/workStore';
import { extractWorkFields } from '../services/llm';
import { hashRecord } from '../services/hashing';
import * as media from '../services/media';
import type { ExtractedFields, WorkRecord } from '../types';
import type { RootStackParamList } from '../navigation/types';

/**
 * LogWork — record + extract + save flow.
 *
 * State machine (linear):
 *   idle → recording → stopped → photo → extracting → review → saving
 *
 * - idle: large round PeggyBlue 96dp record button.
 * - recording: expo-av Audio.Recording, pulsing PaperPlane around button,
 *   live mm:ss timer; tap to stop.
 * - stopped: editable transcript fallback (works without speech-to-text).
 * - photo: expo-camera capture with re-take affordance.
 * - extracting: extractWorkFields(transcript) call with spinner.
 * - review: per-field TextInput form (Plus Jakarta Sans, ink labels,
 *   peggyLavender focus borders).
 * - saving: hashRecord → useWorkStore.upsert → navigate to ProofDetail.
 *   PaperPlane swooshes diagonally on success (400ms / motion.planeSwooshMs).
 */

export type LogWorkProps = NativeStackScreenProps<RootStackParamList, 'LogWork'>;

type Phase =
  | 'idle'
  | 'recording'
  | 'stopped'
  | 'photo'
  | 'extracting'
  | 'review'
  | 'saving';

const RECORD_BUTTON_SIZE = 96;
const PULSE_RADIUS = 60;

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

interface ReviewFields extends ExtractedFields {
  workerName: string;
}

/**
 * Pure predicate: is the LogWork sheet "dirty" — i.e. does the user have
 * anything worth losing? Drives the drag-to-dismiss confirmation.
 * Exported for unit testing; also lets other flows reuse the same rule.
 */
function isDirtyOf(
  fields: Pick<ReviewFields, 'workType' | 'clientName' | 'location' | 'notes'>,
  amountReceivedRaw: string,
  amountPendingRaw: string,
  transcript: string,
  audioUri: string | null,
  photoUri: string | null,
): boolean {
  return (
    fields.workType.trim().length > 0 ||
    (fields.clientName ?? '').trim().length > 0 ||
    (fields.location ?? '').trim().length > 0 ||
    (fields.notes ?? '').trim().length > 0 ||
    amountReceivedRaw.trim().length > 0 ||
    amountPendingRaw.trim().length > 0 ||
    transcript.trim().length > 0 ||
    audioUri !== null ||
    photoUri !== null
  );
}

/**
 * Parse a raw amount input string into a finite number, defaulting to 0.
 * Handles empty strings, leading zeros, decimals, and NaN/Infinity from
 * parseFloat. Pure and exported for unit testing.
 */
function parseAmountOrZero(raw: string): number {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build a persistable WorkRecord draft from review-form input. Pure — the
 * caller is responsible for supplying already-persisted photo/audio URIs
 * and a fresh id + timestamp. The `hash` field is intentionally empty; the
 * canonical hash is computed after this returns and merged in by onSave.
 */
function buildDraftRecord(args: {
  id: string;
  createdAt: string;
  fields: ReviewFields;
  amountReceivedRaw: string;
  amountPendingRaw: string;
  photoUri: string;
  audioUri: string | undefined;
  transcript: string;
}): WorkRecord {
  return {
    id: args.id,
    createdAt: args.createdAt,
    workerName: args.fields.workerName || undefined,
    workType: args.fields.workType,
    clientName: args.fields.clientName || undefined,
    location: args.fields.location || undefined,
    amountReceived: parseAmountOrZero(args.amountReceivedRaw),
    amountPending: parseAmountOrZero(args.amountPendingRaw),
    notes: args.fields.notes || undefined,
    photoUri: args.photoUri,
    audioUri: args.audioUri,
    transcript: args.transcript,
    hash: '',
  };
}

// Exported for unit testing; also re-usable by any future screen that needs
// mm:ss timer formatting or the dirty-guard predicate.
export { formatTimer, isDirtyOf, parseAmountOrZero, buildDraftRecord };

interface RoundRecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
  size: number;
  /** Live recording timer in ms — surfaces in accessibilityValue while recording. */
  recordingMs: number;
}

function RoundRecordButton({
  isRecording,
  onPress,
  size,
  recordingMs,
}: RoundRecordButtonProps): React.ReactElement {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const restLift = reduceMotion ? 0 : -2;
  const lift = useRef(new Animated.Value(restLift)).current;
  // Mirror Button.tsx: hold the in-flight animation in a ref so each press
  // can stop the previous timing before starting the next one. Without this
  // the press-in / press-out timings race and the lift visibly stutters.
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

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
      useNativeDriver: true,
    });
    animationRef.current = next;
    next.start(({ finished }) => {
      if (finished && animationRef.current === next) {
        animationRef.current = null;
      }
    });
  };

  // Cleanup any in-flight animation on unmount so we don't drive Animated.Value
  // updates against a torn-down host component.
  useEffect(() => {
    return () => {
      animationRef.current?.stop();
    };
  }, []);

  // Throttle live VoiceOver announcements during recording to ~30s cadence.
  // The accessibilityValue text below changes every tick, but VoiceOver only
  // reads the value on focus — this announce gives blind users a periodic
  // "still recording, mm:ss" cue without spamming the speech queue.
  const lastAnnounceRef = useRef(0);
  useEffect(() => {
    if (!isRecording) {
      lastAnnounceRef.current = 0;
      return;
    }
    const now = Date.now();
    if (now - lastAnnounceRef.current >= 30_000) {
      lastAnnounceRef.current = now;
      AccessibilityInfo.announceForAccessibility(
        `Recording, ${formatTimer(recordingMs)}`,
      );
    }
  }, [isRecording, recordingMs]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: 'center', justifyContent: 'center' },
        base: {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.peggyBlue,
        },
        rest: { ...theme.shadows.card },
        pressedShadow: { ...theme.shadows.soft },
        pressed: { opacity: 0.85 },
        innerStop: {
          width: 28,
          height: 28,
          borderRadius: 4,
          backgroundColor: theme.colors.peggyInk,
        },
        innerDot: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: theme.colors.peggyInk,
        },
      }),
    [size, theme],
  );

  const animatedStyle = useMemo(
    () => ({ transform: [{ translateY: lift }] }),
    [lift],
  );

  const pressableStyle = (state: PressableStateCallbackType): ViewStyle[] => {
    const out: ViewStyle[] = [
      styles.base,
      state.pressed ? styles.pressedShadow : styles.rest,
    ];
    if (state.pressed) out.push(styles.pressed);
    return out;
  };

  return (
    <Animated.View style={[styles.wrap, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(0)}
        onPressOut={() => animateTo(restLift)}
        android_ripple={{ color: theme.colors.peggyRipple, borderless: true }}
        accessibilityRole="button"
        accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
        accessibilityHint={
          isRecording
            ? 'Stops the audio recording'
            : 'Begins capturing your spoken work log'
        }
        accessibilityState={{ busy: isRecording }}
        accessibilityValue={{
          text: isRecording ? `Recording, ${formatTimer(recordingMs)}` : '',
        }}
        style={pressableStyle}
      >
        <View style={isRecording ? styles.innerStop : styles.innerDot} />
      </Pressable>
    </Animated.View>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
  /** VoiceOver hint forwarded to the underlying TextInput. */
  accessibilityHint?: string;
  /** When true, renders an asterisk after the label and tags it 'required' for VoiceOver. */
  required?: boolean;
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  multiline = false,
  accessibilityHint,
  required = false,
}: FieldProps): React.ReactElement {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginBottom: theme.spacing.base },
        label: {
          ...theme.typography.formLabel,
          color: theme.colors.peggyInk,
          marginBottom: theme.spacing.xs,
        },
        required: {
          color: theme.colors.peggyCoral,
        },
        input: {
          ...theme.typography.body,
          color: theme.colors.peggyInk,
          fontFamily: theme.fontFamilies.sansRegular,
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.sm,
          borderWidth: 2,
          borderColor: focused
            ? theme.colors.peggyLavender
            : theme.colors.hairline,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          minHeight: theme.tapTargets.min,
        },
        multiline: {
          minHeight: theme.tapTargets.min * 2,
          textAlignVertical: 'top',
        },
      }),
    [focused, theme],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={theme.colors.mutedForeground}
        style={[styles.input, multiline && styles.multiline]}
        accessibilityLabel={required ? `${label}, required` : label}
        accessibilityHint={accessibilityHint}
      />
    </View>
  );
}

export function LogWork({ navigation }: LogWorkProps): React.ReactElement {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  // Phase state
  const [phase, setPhase] = useState<Phase>('idle');

  // Permissions
  const [audioPerm, setAudioPerm] =
    useState<Audio.PermissionResponse | null>(null);
  const [cameraPerm, requestCameraPerm] = useCameraPermissions();

  // Recording
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Captured media + transcript
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  // Mirror of capturingRef as state so the Capture button visually disables
  // during the 1-2s takePictureAsync. Refs alone don't trigger re-renders.
  const [capturing, setCapturing] = useState(false);

  // Review form
  const [fields, setFields] = useState<ReviewFields>({
    workType: '',
    clientName: '',
    location: '',
    amountReceived: 0,
    amountPending: 0,
    notes: '',
    workerName: '',
  });
  const [amountReceivedRaw, setAmountReceivedRaw] = useState('');
  const [amountPendingRaw, setAmountPendingRaw] = useState('');
  const [extractError, setExtractError] = useState<string | null>(null);

  // Animations: pulsing ring around record button + save swoosh
  const pulse = useRef(new Animated.Value(0)).current;
  const swoosh = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  // Hold the in-flight swoosh in a ref so we can stop it before re-starting
  // (prevents double-fire if onSave is somehow re-entered) and on unmount,
  // matching the Button.tsx animationRef pattern.
  const swooshRef = useRef<Animated.CompositeAnimation | null>(null);

  // In-flight guards — synchronous refs catch double-taps before the async
  // pipeline that gates them through state can react. Without these, two taps
  // within the prepare/save/capture window each spawn their own pipeline:
  // duplicate records, orphaned mic Recording instances, racing photo captures.
  const startingRef = useRef(false);
  const savingRef = useRef(false);
  const capturingRef = useRef(false);

  // Track whether the screen is still mounted across the long awaits so we
  // don't setState on unmount (and don't navigate from a dead screen).
  const mountedRef = useRef(true);

  // Drag-to-dismiss guard: if the user has captured anything (work-type text,
  // amounts, notes, or a recording), confirm before letting the sheet close.
  // formSheet presentation makes the swipe-down very easy to trigger, so this
  // prevents accidental loss of in-progress logs.
  const isDirty = isDirtyOf(
    fields,
    amountReceivedRaw,
    amountPendingRaw,
    transcript,
    audioUri,
    photoUri,
  );

  useEffect(() => {
    // Skip the guard while the save flow is mid-flight: navigation.replace
    // fires after a successful save and we don't want to prompt the user
    // to discard the very record we just persisted.
    if (phase === 'saving') return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty) return;
      e.preventDefault();
      Alert.alert(
        'Discard log?',
        'You have unsaved changes.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, isDirty, phase]);

  // Permissions on mount — audio only. Camera permission is requested
  // lazily inside goToPhoto() the first time the user advances to the
  // photo step (matches the spec; otherwise the camera dialog pops the
  // moment the user lands on this screen, before they've recorded a word).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const audio = await Audio.requestPermissionsAsync();
        if (!cancelled) setAudioPerm(audio);
      } catch {
        // Leave audioPerm null; UI shows the denied / linking card.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pulse animation lifecycle: only run while recording.
  useEffect(() => {
    if (phase !== 'recording' || reduceMotion) {
      pulseLoopRef.current?.stop();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
    };
  }, [phase, reduceMotion, pulse]);

  // Cleanup: stop ticker + recording on unmount, mark mountedRef false.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (tickRef.current) clearInterval(tickRef.current);
      const r = recordingRef.current;
      if (r) {
        // best-effort cleanup; ignore errors
        r.stopAndUnloadAsync().catch(() => {});
      }
      // Stop the save swoosh too so its end-callback can't navigate from a
      // dead screen (mountedRef gates that path, but cancelling is cleaner).
      swooshRef.current?.stop();
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (startingRef.current || recordingRef.current) return;
    startingRef.current = true;
    try {
      if (!audioPerm?.granted) {
        try {
          const next = await Audio.requestPermissionsAsync();
          if (!mountedRef.current) return;
          setAudioPerm(next);
          if (!next.granted) {
            AccessibilityInfo.announceForAccessibility('Permission denied');
            Alert.alert(
              'Microphone access needed',
              'Workproof needs your microphone to record work logs. Open Settings?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ],
            );
            return;
          }
        } catch {
          return;
        }
      }
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        // Track the in-flight Recording in a ref BEFORE awaiting so the
        // unmount cleanup can stopAndUnload it even if we unmount mid-prepare.
        const recording = new Audio.Recording();
        recordingRef.current = recording;
        await recording.prepareToRecordAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        if (!mountedRef.current) {
          await recording.stopAndUnloadAsync().catch(() => {});
          return;
        }
        await recording.startAsync();
        if (!mountedRef.current) {
          await recording.stopAndUnloadAsync().catch(() => {});
          return;
        }
        const startedAt = Date.now();
        setRecordingMs(0);
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        tickRef.current = setInterval(() => {
          setRecordingMs(Date.now() - startedAt);
        }, 250);
        setPhase('recording');
      } catch {
        // mic-init failed — drop the half-built ref so the next tap can retry.
        // Best-effort unload: prepareToRecordAsync may have already allocated
        // native audio resources before startAsync threw, and a leaked
        // Recording instance keeps the iOS audio session in record mode.
        const half = recordingRef.current;
        recordingRef.current = null;
        if (half) {
          half.stopAndUnloadAsync().catch(() => {});
        }
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        if (mountedRef.current) setPhase('idle');
      }
    } finally {
      startingRef.current = false;
    }
  }, [audioPerm]);

  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (mountedRef.current) setAudioUri(uri);
    } catch {
      // ignore — let user proceed with manual transcript
    }
    // Restore the iOS audio session out of recording mode so playback
    // (e.g. AudioPlayer in ProofDetail) routes to the speaker, and other
    // apps' audio sessions aren't held in record-friendly defaults.
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch {
      // non-fatal — keep advancing
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    recordingRef.current = null;
    if (mountedRef.current) setPhase('stopped');
  }, []);

  const onRecordButtonPress = useCallback(() => {
    if (phase === 'idle') {
      void startRecording();
    } else if (phase === 'recording') {
      void stopRecording();
    }
  }, [phase, startRecording, stopRecording]);

  // Move on to photo step
  const goToPhoto = useCallback(async () => {
    if (!cameraPerm?.granted) {
      const res = await requestCameraPerm();
      if (!res.granted) {
        AccessibilityInfo.announceForAccessibility('Permission denied');
        Alert.alert(
          'Camera access needed',
          'Workproof needs your camera to capture work photos. Open Settings?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
    }
    setPhase('photo');
  }, [cameraPerm, requestCameraPerm]);

  const takePhoto = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam || !cameraReady) return;
    if (capturingRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    try {
      const pic = await cam.takePictureAsync({ quality: 0.8, skipProcessing: false });
      if (!mountedRef.current) return;
      if (pic?.uri) setPhotoUri(pic.uri);
    } catch {
      // leave photoUri null
    } finally {
      capturingRef.current = false;
      if (mountedRef.current) setCapturing(false);
    }
  }, [cameraReady]);

  const retakePhoto = useCallback(() => {
    setPhotoUri(null);
  }, []);

  const goToExtract = useCallback(async () => {
    setPhase('extracting');
    setExtractError(null);
    try {
      // Spec: extraction is on-device. Force the regex baseline so we don't
      // post the worker's transcript to a remote LLM (privacy + offline).
      const extracted = await extractWorkFields(transcript, { online: false });
      if (!mountedRef.current) return;
      // Only merge non-empty extracted values so a re-extract from the
      // photo step doesn't blow away user edits with empty regex output.
      const filtered: Partial<ExtractedFields> = {};
      if (extracted.workType) filtered.workType = extracted.workType;
      if (extracted.clientName) filtered.clientName = extracted.clientName;
      if (extracted.location) filtered.location = extracted.location;
      if (extracted.amountReceived) filtered.amountReceived = extracted.amountReceived;
      if (extracted.amountPending) filtered.amountPending = extracted.amountPending;
      if (extracted.notes) filtered.notes = extracted.notes;
      setFields((prev) => ({ ...prev, ...filtered }));
      if (extracted.amountReceived) {
        setAmountReceivedRaw(String(extracted.amountReceived));
      }
      if (extracted.amountPending) {
        setAmountPendingRaw(String(extracted.amountPending));
      }
    } catch {
      // even on failure, give user the empty review form
      if (mountedRef.current) {
        setExtractError(
          'Could not auto-extract — please fill in the fields below',
        );
        AccessibilityInfo.announceForAccessibility(
          'Auto-extract failed; please review fields manually',
        );
      }
    }
    if (!mountedRef.current) return;
    setPhase('review');
  }, [transcript]);

  const onSave = useCallback(async () => {
    if (!photoUri) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setPhase('saving');

    try {
      // expo-camera / expo-av write into the OS cache, which can be evicted
      // at any time. Copy both into the app's document directory FIRST so the
      // PDF, history thumbnails, and audio playback survive cache eviction.
      // Read bytes from the persisted URIs so the hash binds to the bytes
      // that will exist long-term (they're identical, but this keeps the
      // canonical recipe self-consistent if a future copy step rewrites the
      // file — e.g. transcoding).
      const persistedPhotoUri = await media.ensureCopy(photoUri);
      const persistedAudioUri = audioUri
        ? await media.ensureCopy(audioUri)
        : undefined;
      const photoBytes = await media.readBytes(persistedPhotoUri);
      const audioBytes = persistedAudioUri
        ? await media.readBytes(persistedAudioUri)
        : undefined;
      const id = uuidv4();
      const createdAt = new Date().toISOString();
      const draft = buildDraftRecord({
        id,
        createdAt,
        fields,
        amountReceivedRaw,
        amountPendingRaw,
        photoUri: persistedPhotoUri,
        audioUri: persistedAudioUri,
        transcript,
      });
      const hash = await hashRecord(draft, photoBytes, audioBytes);
      if (!mountedRef.current) return;
      const finalRecord: WorkRecord = { ...draft, hash };
      // upsert now re-throws on persistence failure (workStore returns the
      // error to its caller after recording it in store.error). The catch
      // below is the only place we surface it to the user — without a real
      // throw, a disk-full save would silently navigate to a 404'd
      // ProofDetail entry.
      await useWorkStore.getState().upsert(finalRecord);
      if (!mountedRef.current) return;

      // Confirm to assistive tech, then run the swoosh + navigate.
      AccessibilityInfo.announceForAccessibility('Proof saved');

      if (reduceMotion) {
        navigation.replace('ProofDetail', { id });
        return;
      }
      swooshRef.current?.stop();
      const next = Animated.timing(swoosh, {
        toValue: 1,
        duration: theme.motion.planeSwooshMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      swooshRef.current = next;
      next.start(() => {
        if (!mountedRef.current) return;
        if (swooshRef.current === next) swooshRef.current = null;
        navigation.replace('ProofDetail', { id });
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'We could not save this proof. Please try again.';
      AccessibilityInfo.announceForAccessibility(`Save failed. ${message}`);
      if (mountedRef.current) {
        Alert.alert('Save failed', message);
        setPhase('review');
      }
    } finally {
      savingRef.current = false;
    }
  }, [
    amountPendingRaw,
    amountReceivedRaw,
    audioUri,
    fields,
    navigation,
    photoUri,
    reduceMotion,
    swoosh,
    theme.motion.planeSwooshMs,
    transcript,
  ]);

  // Derived: are we missing all permissions?
  const audioDenied =
    audioPerm !== null && !audioPerm.granted && !audioPerm.canAskAgain;
  const cameraDenied =
    cameraPerm !== null && !cameraPerm.granted && !cameraPerm.canAskAgain;
  const anyPermBlocked = audioDenied || cameraDenied;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: {
          ...theme.typography.h1,
          color: theme.colors.peggyInk,
          marginBottom: theme.spacing.sm,
        },
        subtitle: {
          ...theme.typography.body,
          color: theme.colors.peggyInk,
          marginBottom: theme.spacing.lg,
        },
        center: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: theme.spacing.xxl,
        },
        recordWrap: {
          width: RECORD_BUTTON_SIZE + PULSE_RADIUS * 2,
          height: RECORD_BUTTON_SIZE + PULSE_RADIUS * 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pulseRing: {
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
        },
        timer: {
          ...theme.typography.display,
          color: theme.colors.peggyInk,
          marginTop: theme.spacing.lg,
        },
        helper: {
          ...theme.typography.body,
          color: theme.colors.mutedForeground,
          marginTop: theme.spacing.md,
          textAlign: 'center',
        },
        textArea: {
          ...theme.typography.body,
          color: theme.colors.peggyInk,
          fontFamily: theme.fontFamilies.sansRegular,
          minHeight: 140,
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.sm,
          borderWidth: 2,
          borderColor: theme.colors.hairline,
          padding: theme.spacing.md,
          textAlignVertical: 'top',
          marginBottom: theme.spacing.lg,
        },
        actions: {
          flexDirection: 'row',
          gap: theme.spacing.md,
          marginTop: theme.spacing.base,
        },
        actionFlex: { flex: 1 },
        camera: {
          width: '100%',
          aspectRatio: 16 / 9,
          borderRadius: theme.radii.md,
          overflow: 'hidden',
          backgroundColor: theme.colors.peggyInk,
          marginBottom: theme.spacing.base,
        },
        thumbCard: {
          marginBottom: theme.spacing.base,
          padding: 0,
          overflow: 'hidden',
        },
        thumb: {
          width: '100%',
          aspectRatio: 16 / 9,
          borderTopLeftRadius: theme.radii.md,
          borderTopRightRadius: theme.radii.md,
        },
        thumbActions: {
          flexDirection: 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.base,
        },
        permRow: {
          alignItems: 'center',
          paddingVertical: theme.spacing.lg,
        },
        permText: {
          ...theme.typography.body,
          color: theme.colors.peggyInk,
          textAlign: 'center',
          marginVertical: theme.spacing.base,
        },
        formLabel: {
          ...theme.typography.formLabel,
          color: theme.colors.peggyInk,
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
        },
        savingOverlay: {
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        },
      }),
    [theme],
  );

  // Render permission-denied card (used when both perms blocked from settings).
  const renderPermissionBlock = (): React.ReactElement => (
    <Card variant="standard">
      <View style={styles.permRow}>
        <Doodle variant="family" size={120} />
        <Text style={styles.permText}>
          Workproof needs your microphone and camera to log work. Please enable
          them in Settings to continue.
        </Text>
        <Button
          label="Open Settings"
          onPress={() => {
            void Linking.openSettings();
          }}
          variant="primary"
        />
      </View>
    </Card>
  );

  // ---- Per-phase content ----

  const renderIdle = (): React.ReactElement => (
    <View style={styles.center}>
      <Text style={styles.title}>Log today's work</Text>
      <Text style={styles.helper}>Tap to start recording your voice note.</Text>
      <View style={[styles.recordWrap, { marginTop: theme.spacing.xl }]}>
        <RoundRecordButton
          isRecording={false}
          onPress={onRecordButtonPress}
          size={RECORD_BUTTON_SIZE}
          recordingMs={recordingMs}
        />
      </View>
    </View>
  );

  const renderRecording = (): React.ReactElement => {
    const pulseScale = pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.45],
    });
    const pulseOpacity = pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.9, 0.2],
    });
    return (
      <View style={styles.center}>
        <Text style={styles.timer}>{formatTimer(recordingMs)}</Text>
        <Text style={styles.helper}>Recording… tap to stop.</Text>
        <View style={[styles.recordWrap, { marginTop: theme.spacing.xl }]}>
          {/* Pulsing PaperPlane ring (decorative) */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              {
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          >
            <View
              style={{
                width: RECORD_BUTTON_SIZE + 32,
                height: RECORD_BUTTON_SIZE + 32,
                borderRadius: (RECORD_BUTTON_SIZE + 32) / 2,
                borderWidth: 2,
                borderColor: theme.colors.peggyBlue,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PaperPlane size={28} rotation={-12} />
            </View>
          </Animated.View>
          <RoundRecordButton
            isRecording={true}
            onPress={onRecordButtonPress}
            size={RECORD_BUTTON_SIZE}
            recordingMs={recordingMs}
          />
        </View>
      </View>
    );
  };

  const reRecord = useCallback(() => {
    // Throw away the captured audio so the user can re-record from idle.
    // The audio bytes are part of the proof hash, so editing the transcript
    // alone after a misfire isn't enough — they need fresh audio.
    setAudioUri(null);
    setRecordingMs(0);
    recordingRef.current = null;
    setPhase('idle');
  }, []);

  const renderStopped = (): React.ReactElement => (
    <View>
      <Text style={styles.title}>Review transcript</Text>
      <Text style={styles.subtitle}>
        Edit your spoken note before we extract the fields. (Speech-to-text is
        not yet wired up — type your transcript here.)
      </Text>
      <TextInput
        value={transcript}
        onChangeText={setTranscript}
        multiline
        placeholder="e.g. Did plastering for Sharma Construction in Andheri. Got 5000, pending 2500."
        placeholderTextColor={theme.colors.mutedForeground}
        style={styles.textArea}
        accessibilityLabel="Transcript"
      />
      <View style={styles.actions}>
        <View style={styles.actionFlex}>
          <Button
            label="Re-record"
            onPress={reRecord}
            variant="secondary"
          />
        </View>
        <View style={styles.actionFlex}>
          <Button
            label="Take photo of work"
            onPress={() => void goToPhoto()}
            variant="primary"
            disabled={transcript.trim().length === 0}
          />
        </View>
      </View>
    </View>
  );

  const renderPhoto = (): React.ReactElement => (
    <View>
      <Text style={styles.title}>Photo of completed work</Text>
      <Text style={styles.subtitle}>
        Frame the finished job. The image becomes part of the proof hash.
      </Text>
      {photoUri ? (
        <>
          <Card variant="standard" style={styles.thumbCard}>
            <Image
              source={{ uri: photoUri }}
              style={styles.thumb}
              accessibilityIgnoresInvertColors
              accessibilityLabel="Captured photo"
            />
            <View style={styles.thumbActions}>
              <View style={styles.actionFlex}>
                <Button
                  label="Re-take"
                  onPress={retakePhoto}
                  variant="secondary"
                />
              </View>
              <View style={styles.actionFlex}>
                <Button
                  label="Use this"
                  onPress={() => void goToExtract()}
                  variant="primary"
                />
              </View>
            </View>
          </Card>
          <View style={[styles.actions, { marginTop: theme.spacing.md }]}>
            <View style={styles.actionFlex}>
              <Button
                label="Back"
                onPress={() => setPhase('stopped')}
                variant="secondary"
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={styles.camera}>
            <CameraView
              ref={cameraRef}
              style={{ flex: 1 }}
              facing="back"
              onCameraReady={() => setCameraReady(true)}
            />
          </View>
          <View style={styles.actions}>
            <View style={styles.actionFlex}>
              <Button
                label="Back"
                onPress={() => setPhase('stopped')}
                variant="secondary"
              />
            </View>
            <View style={styles.actionFlex}>
              <Button
                label={capturing ? 'Capturing…' : 'Capture'}
                onPress={() => void takePhoto()}
                variant="primary"
                disabled={!cameraReady || capturing}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );

  const renderExtracting = (): React.ReactElement => (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel="Extracting fields, please wait"
      style={styles.center}
    >
      <ActivityIndicator
        size="large"
        color={theme.colors.peggyInk}
        accessibilityLabel="Extracting"
      />
      <Text style={styles.helper}>Extracting fields...</Text>
    </View>
  );

  const renderReview = (): React.ReactElement => (
    <View>
      <Text style={styles.title}>Review proof</Text>
      <Text style={styles.subtitle}>
        Make any corrections, then save. Your edits become the canonical
        record.
      </Text>
      {extractError ? (
        <Card
          variant="standard"
          style={{
            borderColor: theme.colors.peggyCoral,
            borderWidth: 2,
            marginBottom: theme.spacing.base,
          }}
        >
          <Text style={{ ...theme.typography.body, color: theme.colors.peggyInk }}>
            {extractError}
          </Text>
        </Card>
      ) : null}
      <Field
        label="Worker name"
        value={fields.workerName}
        onChangeText={(v) => setFields((f) => ({ ...f, workerName: v }))}
      />
      <Field
        label="Work type"
        value={fields.workType}
        onChangeText={(v) => setFields((f) => ({ ...f, workType: v }))}
        required
        accessibilityHint="Required. Describe the kind of work, for example plastering or wiring."
      />
      <Field
        label="Client name"
        value={fields.clientName ?? ''}
        onChangeText={(v) => setFields((f) => ({ ...f, clientName: v }))}
      />
      <Field
        label="Location"
        value={fields.location ?? ''}
        onChangeText={(v) => setFields((f) => ({ ...f, location: v }))}
      />
      <Field
        label="Amount received"
        value={amountReceivedRaw}
        keyboardType="numeric"
        onChangeText={setAmountReceivedRaw}
        accessibilityHint="Enter the cash already collected, in rupees."
      />
      <Field
        label="Amount pending"
        value={amountPendingRaw}
        keyboardType="numeric"
        onChangeText={setAmountPendingRaw}
        accessibilityHint="Enter the amount still owed, in rupees."
      />
      <Field
        label="Notes"
        value={fields.notes ?? ''}
        onChangeText={(v) => setFields((f) => ({ ...f, notes: v }))}
        multiline
        accessibilityHint="Multi-line notes about the work."
      />
      <View style={styles.actions}>
        <View style={styles.actionFlex}>
          <Button
            label="Back"
            onPress={() => {
              setExtractError(null);
              setPhase('photo');
            }}
            variant="secondary"
          />
        </View>
        <View style={styles.actionFlex}>
          <Button
            label={phase === 'saving' ? 'Saving…' : 'Save proof'}
            onPress={() => void onSave()}
            variant="primary"
            disabled={!fields.workType.trim() || phase === 'saving'}
            busy={phase === 'saving'}
          />
        </View>
      </View>
      {!fields.workType.trim() ? (
        <Text
          accessibilityLiveRegion="assertive"
          style={[styles.helper, { textAlign: 'left', marginTop: theme.spacing.sm }]}
        >
          Add the work type to save.
        </Text>
      ) : null}
    </View>
  );

  const renderSaving = (): React.ReactElement => {
    const swooshTranslateX = swoosh.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 320],
    });
    const swooshTranslateY = swoosh.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -240],
    });
    const swooshOpacity = swoosh.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [1, 1, 0],
    });
    return (
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel="Saving proof, please wait"
        style={styles.center}
      >
        <ActivityIndicator
          size="large"
          color={theme.colors.peggyInk}
          accessibilityLabel="Saving"
        />
        <Text style={styles.helper}>Saving proof…</Text>
        <Animated.View
          pointerEvents="none"
          style={{
            marginTop: theme.spacing.xl,
            opacity: swooshOpacity,
            transform: [
              { translateX: swooshTranslateX },
              { translateY: swooshTranslateY },
            ],
          }}
        >
          <PaperPlane size={32} rotation={-25} withTrail />
        </Animated.View>
      </View>
    );
  };

  let body: React.ReactElement;
  if (anyPermBlocked && (phase === 'idle' || phase === 'photo')) {
    body = renderPermissionBlock();
  } else {
    switch (phase) {
      case 'idle':
        body = renderIdle();
        break;
      case 'recording':
        body = renderRecording();
        break;
      case 'stopped':
        body = renderStopped();
        break;
      case 'photo':
        body = renderPhoto();
        break;
      case 'extracting':
        body = renderExtracting();
        break;
      case 'review':
        body = renderReview();
        break;
      case 'saving':
        body = renderSaving();
        break;
      default:
        body = renderIdle();
    }
  }

  return (
    <ScreenScaffold
      testID="log-work-screen"
      contentStyle={{ paddingBottom: theme.spacing.xxl * 4 }}
      // formSheet presentation already inserts a top inset under the grabber;
      // skipping the top edge here avoids doubling the safe-area padding.
      edges={['bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        // On Android the soft keyboard hides the bottom Save/Back row of the
        // 7-input review form without this; iOS handles it via 'padding'.
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        {body}
      </KeyboardAvoidingView>
    </ScreenScaffold>
  );
}
