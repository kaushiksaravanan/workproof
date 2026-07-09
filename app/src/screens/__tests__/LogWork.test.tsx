import React from 'react';

// --- Heavy native-module mocks (must be declared before importing LogWork) ---

// expo-camera: render a plain View and expose useCameraPermissions hook.
jest.mock('expo-camera', () => {
  const RN = require('react-native');
  const ReactLocal = require('react');
  const CameraView = ReactLocal.forwardRef((props: any, _ref: any) =>
    ReactLocal.createElement(RN.View, { testID: 'camera-mock', ...props }),
  );
  CameraView.displayName = 'CameraViewMock';
  return {
    CameraView,
    useCameraPermissions: () => [
      { granted: true, canAskAgain: true, status: 'granted', expires: 'never' },
      jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted' })),
    ],
  };
});

// expo-av: stub Audio.Recording / Audio.Sound classes + setAudioModeAsync.
jest.mock('expo-av', () => {
  class Recording {
    prepareToRecordAsync = jest.fn(async () => undefined);
    startAsync = jest.fn(async () => undefined);
    stopAndUnloadAsync = jest.fn(async () => undefined);
    getURI = jest.fn(() => 'file:///mock-audio.m4a');
  }
  class Sound {
    static createAsync = jest.fn(async () => ({ sound: new Sound() }));
    loadAsync = jest.fn(async () => undefined);
    unloadAsync = jest.fn(async () => undefined);
    playAsync = jest.fn(async () => undefined);
    pauseAsync = jest.fn(async () => undefined);
    setOnPlaybackStatusUpdate = jest.fn();
  }
  return {
    Audio: {
      Recording,
      Sound,
      requestPermissionsAsync: jest.fn(async () => ({
        granted: true,
        canAskAgain: true,
        status: 'granted',
      })),
      setAudioModeAsync: jest.fn(async () => undefined),
      RecordingOptionsPresets: { HIGH_QUALITY: {} },
    },
  };
});

// expo-file-system: stubs for the few functions media.ts touches.
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///doc/',
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  copyAsync: jest.fn(async () => undefined),
  readAsStringAsync: jest.fn(async () => ''),
  writeAsStringAsync: jest.fn(async () => undefined),
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

// Internal media service — simpler to mock than to thread through file-system.
jest.mock('../../services/media', () => ({
  ensureCopy: jest.fn(async (uri: string) => uri),
  readBytes: jest.fn(async () => new Uint8Array()),
}));

// LLM extractor — keep deterministic + sync-ish.
jest.mock('../../services/llm', () => ({
  extractWorkFields: jest.fn(async () => ({
    workType: '',
    clientName: '',
    location: '',
    amountReceived: 0,
    amountPending: 0,
    notes: '',
  })),
}));

// Hashing — avoid pulling expo-crypto.
jest.mock('../../services/hashing', () => ({
  hashRecord: jest.fn(async () => 'mock-hash'),
}));

// Work store — same pattern as Home test.
jest.mock('../../state/workStore', () => {
  const upsert = jest.fn(async () => undefined);
  const state = {
    records: [],
    loading: false,
    error: null,
    hasHydrated: true,
    refresh: jest.fn(async () => undefined),
    upsert,
    remove: jest.fn(async () => undefined),
    setAnchored: jest.fn(async () => undefined),
    clearError: jest.fn(),
  };
  const useWorkStore: any = (selector?: (s: any) => any) =>
    selector ? selector(state) : state;
  useWorkStore.getState = () => state;
  useWorkStore.setState = (partial: any) => Object.assign(state, partial);
  return { useWorkStore };
});

// uuid — stable id under test.
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

// react-native-get-random-values is a side-effect polyfill — no-op it.
jest.mock('react-native-get-random-values', () => ({}));

// --- Now safe to import test deps + the screen under test ---

import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { LogWork, formatTimer } from '../LogWork';

function makeNavigation(overrides: Partial<any> = {}) {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
    dispatch: jest.fn(),
    addListener: jest.fn(() => jest.fn()), // returns unsubscribe
    removeListener: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
    isFocused: jest.fn(() => true),
    canGoBack: jest.fn(() => true),
    getId: jest.fn(),
    getParent: jest.fn(),
    getState: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  } as any;
}

function renderLogWork(navigation = makeNavigation()) {
  const route = { key: 'LogWork-test', name: 'LogWork', params: undefined } as any;
  return render(
    <ThemeProvider>
      <LogWork navigation={navigation} route={route} />
    </ThemeProvider>,
  );
}

describe('LogWork (shallow)', () => {
  it('renders the screen without throwing', () => {
    const { getByTestId } = renderLogWork();
    // ScreenScaffold receives testID="log-work-screen" from LogWork.
    expect(getByTestId('log-work-screen')).toBeTruthy();
  });

  it('exposes an accessibilityLabel on the record / capture button', () => {
    // In the idle phase the primary CTA is the round record button with
    // accessibilityLabel="Start recording" and accessibilityRole="button".
    const { getByLabelText } = renderLogWork();
    const recordBtn = getByLabelText('Start recording');
    expect(recordBtn).toBeTruthy();
    expect(recordBtn.props.accessibilityRole).toBe('button');
  });

  it('registers a beforeRemove listener so swipe-dismiss is intercepted', () => {
    // LogWork has no explicit Cancel button (formSheet relies on swipe-down).
    // Instead we assert the navigation guard wires up correctly: the screen
    // calls navigation.addListener('beforeRemove', ...) on mount, and the
    // confirmation dispatches via navigation.dispatch on Discard. This is the
    // closest analog to "cancel button -> navigation.goBack" for this screen.
    const navigation = makeNavigation();
    renderLogWork(navigation);
    expect(navigation.addListener).toHaveBeenCalled();
    const calls = (navigation.addListener as jest.Mock).mock.calls;
    const events = calls.map((c) => c[0]);
    expect(events).toContain('beforeRemove');
  });

  it('keeps the record button labelled "Start recording" in idle phase', () => {
    // State-machine probe: the screen starts in phase='idle'. The round
    // record button should advertise the start label (not stop), confirming
    // we never auto-advanced past idle on mount.
    const { getByLabelText, queryByLabelText } = renderLogWork();
    expect(getByLabelText('Start recording')).toBeTruthy();
    expect(queryByLabelText('Stop recording')).toBeNull();
  });

  it('beforeRemove listener no-ops when the screen is clean (isDirty=false)', () => {
    const navigation = makeNavigation();
    renderLogWork(navigation);
    // Grab the beforeRemove listener that was registered on mount.
    const call = (navigation.addListener as jest.Mock).mock.calls.find(
      (c) => c[0] === 'beforeRemove',
    );
    expect(call).toBeTruthy();
    const listener = call![1];
    // Fresh screen — no user input yet — should let dismissal through.
    const e = {
      preventDefault: jest.fn(),
      data: { action: { type: 'GO_BACK' } },
    };
    listener(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('cleans up the beforeRemove listener on unmount', () => {
    const unsubscribe = jest.fn();
    const navigation = makeNavigation({
      addListener: jest.fn(() => unsubscribe),
    });
    const { unmount } = renderLogWork(navigation);
    expect(unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('formatTimer (pure)', () => {
  it('renders 0ms as 00:00', () => {
    expect(formatTimer(0)).toBe('00:00');
  });

  it('renders sub-second values as 00:00 (floors)', () => {
    expect(formatTimer(500)).toBe('00:00');
    expect(formatTimer(999)).toBe('00:00');
  });

  it('renders exactly 1s as 00:01', () => {
    expect(formatTimer(1000)).toBe('00:01');
  });

  it('renders under 1 minute as 00:SS', () => {
    expect(formatTimer(45_000)).toBe('00:45');
  });

  it('renders exactly 1 minute as 01:00', () => {
    expect(formatTimer(60_000)).toBe('01:00');
  });

  it('renders arbitrary mm:ss', () => {
    expect(formatTimer(2 * 60_000 + 37_000)).toBe('02:37');
  });

  it('pads single-digit minutes/seconds with a leading zero', () => {
    expect(formatTimer(9_000)).toBe('00:09');
    expect(formatTimer(5 * 60_000 + 3_000)).toBe('05:03');
  });

  it('handles 60+ minutes without wrapping (voice notes rarely go this long, but sanity)', () => {
    // 65 minutes = 3_900_000 ms → mm=65 (no wrap), ss=00
    expect(formatTimer(65 * 60_000)).toBe('65:00');
  });
});
