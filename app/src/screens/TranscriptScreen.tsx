import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { useTheme } from '../theme/ThemeProvider';

/**
 * TranscriptScreen — renders a voice-report transcript on the notebook
 * surface (white card with horizontal rule lines, 24dp left margin) per
 * the task brief's "notebook paper on transcript" requirement.
 */

export interface TranscriptScreenProps {
  transcript?: string;
}

const PLACEHOLDER =
  'Tap the mic to record your work. The transcript appears here on notebook paper, ready for you to clean up before saving.';

export function TranscriptScreen({
  transcript,
}: TranscriptScreenProps): React.ReactElement {
  const theme = useTheme();

  const styles = StyleSheet.create({
    title: {
      ...theme.typography.h1,
      color: theme.colors.peggyInk,
      marginBottom: theme.spacing.base,
    },
    body: {
      ...theme.typography.body,
      color: theme.colors.peggyInk,
      lineHeight: 24, // align text rows with the rule grid (RULE_GAP)
    },
    section: {
      marginBottom: theme.spacing.lg,
    },
  });

  return (
    <ScreenScaffold testID="transcript-screen">
      <View style={styles.section}>
        <Text style={styles.title}>Transcript</Text>
      </View>
      <Card variant="notebook" accessibilityLabel="Transcript">
        <Text style={styles.body}>{transcript ?? PLACEHOLDER}</Text>
      </Card>
    </ScreenScaffold>
  );
}
