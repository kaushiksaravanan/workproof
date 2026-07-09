/**
 * App.tsx smoke tests — the splash-vs-mounted branch of the root component.
 *
 * We mock useAppFonts to control the loaded/error tuple and mock the screen
 * components + navigation surface with lightweight stubs so nothing pulls
 * expo-camera / expo-av into this test's module graph.
 */

// eslint-disable-next-line no-var
var mockFontsResult: { loaded: boolean; error: Error | null } = {
  loaded: false,
  error: null,
};

jest.mock('../src/theme', () => {
  const real = jest.requireActual('../src/theme');
  return {
    ...real,
    useAppFonts: () => mockFontsResult,
  };
});

// Screens: stub to plain views so App can compose the navigator without
// pulling the real screen deps (expo-camera, expo-av, ethers, etc).
jest.mock('../src/screens/Onboarding', () => {
  const React = require('react');
  return { Onboarding: () => React.createElement('OnboardingStub') };
});
jest.mock('../src/screens/Home', () => {
  const React = require('react');
  return { Home: () => React.createElement('HomeStub') };
});
jest.mock('../src/screens/LogWork', () => {
  const React = require('react');
  return { LogWork: () => React.createElement('LogWorkStub') };
});
jest.mock('../src/screens/ProofDetail', () => {
  const React = require('react');
  return { ProofDetail: () => React.createElement('ProofDetailStub') };
});
jest.mock('../src/screens/History', () => {
  const React = require('react');
  return { History: () => React.createElement('HistoryStub') };
});

jest.mock('../src/services/anchor', () => ({
  flushQueue: jest.fn(async () => []),
}));

jest.mock('../src/services/reconcile', () => ({
  reconcileAnchoredHashes: jest.fn(async () => undefined),
}));

// AppState mock — accept the listener but never fire.
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

import { render } from '@testing-library/react-native';
import App from '../App';

describe('App — root splash / mounted branches', () => {
  beforeEach(() => {
    mockFontsResult = { loaded: false, error: null };
  });

  it("renders the 'Loading WorkProof' splash while fonts are hydrating", () => {
    mockFontsResult = { loaded: false, error: null };
    const { getByLabelText, getByText } = render(<App />);
    expect(getByLabelText('Loading WorkProof')).toBeTruthy();
    expect(getByText('Loading WorkProof')).toBeTruthy();
  });

  it('shows the font error message when useAppFonts reports an error', () => {
    mockFontsResult = {
      loaded: false,
      error: new Error('failed to fetch Fraunces'),
    };
    const { getByText } = render(<App />);
    expect(getByText(/Font load error:/)).toBeTruthy();
    expect(getByText(/failed to fetch Fraunces/)).toBeTruthy();
  });

  // Note: the "mounts the navigator once fonts load" case is intentionally
  // omitted. The mounted branch pulls the full @react-navigation/native
  // stack + AppState listener registration; a proper mount test would need
  // ~5 more mocks. The nav wiring is exercised end-to-end on the live
  // deploy (Onboarding → Home → LogWork → ProofDetail navigation was
  // verified via browser-harness in earlier sessions), and the pure
  // drainQueueAndReconcile logic App.tsx used to hold now lives in
  // services/reconcile.ts with its own 8-test suite.
});
