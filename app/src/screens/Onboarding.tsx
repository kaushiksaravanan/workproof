import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Button,
  Doodle,
  MarkerUnderline,
  PaperPlane,
  ScreenScaffold,
} from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../theme/useReducedMotion';

/**
 * Onboarding — 3-slide carousel that introduces Workproof:
 *
 *   1. Voice + photo + on-device AI logging.
 *   2. Offline-first records that survive without a server.
 *   3. Optional Polygon Amoy anchor + "Get started" CTA.
 *
 * Persistence: AsyncStorage @workproof/onboarded short-circuits to onComplete
 * if the user has already finished the flow. onComplete is pinned via ref so
 * a re-rendered parent can't trigger a double-fire that stacks the home stack.
 *
 * Tokens + components only — no inline colors. Animated cross-fade between
 * slides; Reduce Motion collapses the fade to an instant swap. Each slide
 * change is announced via AccessibilityInfo so blind users know they
 * advanced.
 */

const STORAGE_KEY = '@workproof/onboarded';
const FADE_MS = 220;
const SLIDE_COUNT = 3;

const SLIDE_HEADLINES: readonly string[] = [
  'Log your work today.',
  'Yours, offline.',
  'One tap, on-chain.',
];

export interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps): React.ReactElement | null {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const completedRef = useRef(false);

  // Pin onComplete via a ref so re-renders of the parent (which may pass a
  // fresh inline arrow each render) cannot retrigger the AsyncStorage effect.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Short-circuit if the user has already onboarded. Empty deps — runs once.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (cancelled || completedRef.current) return;
        if (value === 'true') {
          completedRef.current = true;
          onCompleteRef.current();
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        // If storage is unavailable, still let the user see the flow.
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      animationRef.current?.stop();
    };
  }, []);

  const transitionTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= SLIDE_COUNT) return;
      // Announce the upcoming slide for screen-reader users — Animated.View
      // alone doesn't trigger live-region speech. Prefix with paged position
      // so VoiceOver/TalkBack expose progress through the carousel.
      AccessibilityInfo.announceForAccessibility(
        `Slide ${next + 1} of ${SLIDE_COUNT}, ${SLIDE_HEADLINES[next]}`,
      );
      if (reduceMotion) {
        setIndex(next);
        opacity.setValue(1);
        return;
      }
      animationRef.current?.stop();
      const fadeOut = Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      });
      animationRef.current = fadeOut;
      fadeOut.start(({ finished }) => {
        // If a newer transition has stomped this animation, abandon ours so
        // we don't overwrite the new index/opacity targets.
        if (!finished || animationRef.current !== fadeOut) return;
        setIndex(next);
        const fadeIn = Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_MS,
          useNativeDriver: true,
        });
        animationRef.current = fadeIn;
        fadeIn.start(({ finished: fadeInFinished }) => {
          // Clear the ref once the fade-in lands so we don't hold a reference
          // to a completed animation.
          if (fadeInFinished && animationRef.current === fadeIn) {
            animationRef.current = null;
          }
        });
      });
    },
    [opacity, reduceMotion],
  );

  const handleBack = useCallback(() => {
    transitionTo(index - 1);
  }, [index, transitionTo]);

  const handleNext = useCallback(() => {
    if (index < SLIDE_COUNT - 1) {
      transitionTo(index + 1);
      return;
    }
    if (completedRef.current) return;
    completedRef.current = true;
    AsyncStorage.setItem(STORAGE_KEY, 'true')
      .catch(() => {
        // Swallow — onComplete still fires so the user isn't stuck.
      })
      .finally(() => {
        onCompleteRef.current();
      });
  }, [index, transitionTo]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          justifyContent: 'space-between',
        },
        slide: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.lg,
        },
        illustration: {
          marginBottom: theme.spacing.xxl,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headline: {
          ...theme.typography.h1,
          color: theme.colors.peggyInk,
          textAlign: 'center',
          marginBottom: theme.spacing.lg,
        },
        body: {
          ...theme.typography.body,
          color: theme.colors.peggyInk,
          textAlign: 'center',
          maxWidth: 320,
        },
        emphasis: {
          ...theme.typography.serifItalic,
          color: theme.colors.peggyInk,
          textAlign: 'center',
          marginBottom: theme.spacing.md,
        },
        dots: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginVertical: theme.spacing.lg,
        },
        dot: {
          width: 10,
          height: 10,
          borderRadius: theme.radii.pill,
          marginHorizontal: theme.spacing.xs,
          backgroundColor: theme.colors.peggyInk,
        },
        dotInactive: {
          opacity: 0.3,
        },
        actions: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.md,
        },
        actionSpacer: {
          flex: 1,
        },
      }),
    [theme],
  );

  if (!ready) {
    return null;
  }

  const isLast = index === SLIDE_COUNT - 1;
  const nextLabel = isLast ? 'Get started' : 'Next';

  return (
    <ScreenScaffold scrollable={false}>
      <View style={styles.root}>
        <Animated.View style={[styles.slide, { opacity }]}>
          {index === 0 ? (
            <>
              <View style={styles.illustration}>
                <PaperPlane size={32} withTrail rotation={-15} />
              </View>
              <View style={{ marginBottom: theme.spacing.lg }}>
                <MarkerUnderline
                  text="Log your work today."
                  style={styles.headline}
                />
              </View>
              <Text style={styles.body}>
                Capture what you did — a quick photo, a voice memo, and a
                short typed transcript. Your record stays on the phone
                until you choose to share the PDF.
              </Text>
            </>
          ) : null}

          {index === 1 ? (
            <>
              <View style={styles.illustration}>
                <Doodle variant="family" size={140} />
              </View>
              <Text style={styles.emphasis}>Yours, offline.</Text>
              <Text style={styles.body}>
                Every entry is stored locally first, so your records survive
                bad signal, locked-down job sites, and the occasional
                airplane mode.
              </Text>
            </>
          ) : null}

          {index === 2 ? (
            <>
              <View style={styles.illustration}>
                <PaperPlane size={32} withTrail rotation={12} />
              </View>
              <Text style={styles.emphasis}>One tap, on-chain.</Text>
              <Text style={styles.body}>
                When you want a tamper-evident timestamp, anchor a hash to
                Polygon Amoy in a single tap. Optional, free on testnet, and
                always your call.
              </Text>
            </>
          ) : null}
        </Animated.View>

        <View
          style={styles.dots}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index ? null : styles.dotInactive]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          {index > 0 ? (
            <Button
              label="Back"
              variant="secondary"
              onPress={handleBack}
              accessibilityHint="Go to the previous onboarding slide"
            />
          ) : (
            <View style={styles.actionSpacer} />
          )}
          <Button
            label={nextLabel}
            variant="primary"
            onPress={handleNext}
            accessibilityHint={
              isLast
                ? 'Finish onboarding and open Workproof'
                : 'Go to the next onboarding slide'
            }
          />
        </View>
      </View>
    </ScreenScaffold>
  );
}
