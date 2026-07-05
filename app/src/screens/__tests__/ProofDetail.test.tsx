import React from 'react';

// --- Native-module mocks (must precede ProofDetail import) ---

jest.mock('expo-av', () => {
  class Sound {
    static createAsync = jest.fn(async () => ({ sound: new Sound() }));
    loadAsync = jest.fn(async () => undefined);
    unloadAsync = jest.fn(async () => undefined);
    playAsync = jest.fn(async () => undefined);
    pauseAsync = jest.fn(async () => undefined);
    setOnPlaybackStatusUpdate = jest.fn();
    setPositionAsync = jest.fn(async () => undefined);
    getStatusAsync = jest.fn(async () => ({
      isLoaded: true,
      isPlaying: false,
      didJustFinish: false,
      durationMillis: 1000,
      positionMillis: 0,
    }));
  }
  return {
    Audio: {
      Sound,
      setAudioModeAsync: jest.fn(async () => undefined),
    },
  };
});

const mockGenerateProofPdf = jest.fn(async (..._args: unknown[]) => ({
  pdfUri: 'file:///mock-proof.pdf',
}));
const mockShareProofPdf = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('../../services/proof', () => ({
  generateProofPdf: (...args: unknown[]) => mockGenerateProofPdf(...args),
  shareProofPdf: (...args: unknown[]) => mockShareProofPdf(...args),
}));

const mockAnchorHash = jest.fn(async (..._args: unknown[]) => ({
  txHash: '0xtxhash',
  chainId: 80002,
  explorerUrl: 'https://amoy.polygonscan.com/tx/0xtxhash',
}));
jest.mock('../../services/anchor', () => ({
  anchorHash: (...args: unknown[]) => mockAnchorHash(...args),
  explorerUrl: (tx: string) => `https://amoy.polygonscan.com/tx/${tx}`,
  flushQueue: jest.fn(async () => []),
}));

// Work store: stateful, supports selector + getState.
import type { WorkRecord } from '../../types';

const anchoredRec: WorkRecord = {
  id: 'rec-anchored',
  createdAt: '2026-06-20T00:00:00.000Z',
  workType: 'Roof tiles',
  clientName: 'Asha',
  amountReceived: 1500,
  amountPending: 0,
  photoUri: 'file:///photo.jpg',
  transcript: 'Patched the south slope.',
  hash: '0xdeadbeefcafebabe1234567890abcdef',
  anchorTxHash: '0xanchortxhash',
  anchorChainId: 80002,
};

const pendingRec: WorkRecord = {
  ...anchoredRec,
  id: 'rec-pending',
  workType: 'Garden cleanup',
  clientName: 'Ravi',
  hash: '0x1111aaaa2222bbbb3333cccc4444dddd',
  anchorTxHash: undefined,
  anchorChainId: undefined,
};

const queuedRec: WorkRecord = {
  ...anchoredRec,
  id: 'rec-queued',
  workType: 'Fence repair',
  clientName: 'Meera',
  hash: '0x9999eeee8888ffff7777dddd6666cccc',
  anchorTxHash: 'queued:0x9999eeee8888ffff7777dddd6666cccc',
  anchorChainId: 80002,
  audioUri: 'file:///voice.m4a',
};

const noAudioRec: WorkRecord = {
  ...pendingRec,
  id: 'rec-no-audio',
  audioUri: undefined,
};

let mockState: {
  records: WorkRecord[];
  setAnchored: jest.Mock;
  remove: jest.Mock;
};

jest.mock('../../state/workStore', () => {
  const useWorkStore: any = (selector?: (s: typeof mockState) => unknown) => {
    if (typeof selector === 'function') return selector(mockState);
    return mockState;
  };
  useWorkStore.getState = () => mockState;
  return { useWorkStore };
});

// --- Imports (after mocks) ---

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ProofDetail } from '../ProofDetail';

function makeNav() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    pop: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => () => {}),
    removeListener: jest.fn(),
    isFocused: jest.fn(() => true),
    canGoBack: jest.fn(() => true),
    dispatch: jest.fn(),
    reset: jest.fn(),
    getId: jest.fn(),
    getParent: jest.fn(),
    getState: jest.fn(),
  } as any;
}

function renderProofDetail(id: string, navigation = makeNav()) {
  const route = {
    key: 'pd-test',
    name: 'ProofDetail',
    params: { id },
  } as any;
  return {
    navigation,
    ...render(
      <ThemeProvider>
        <ProofDetail navigation={navigation} route={route} />
      </ThemeProvider>,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState = {
    records: [anchoredRec, pendingRec, queuedRec, noAudioRec],
    setAnchored: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
  };
});

describe('ProofDetail', () => {
  it('renders the record workType and clientName', () => {
    const { getByText } = renderProofDetail('rec-anchored');
    expect(getByText('Roof tiles')).toBeTruthy();
    expect(getByText('Asha')).toBeTruthy();
  });

  it("anchored record shows the 'ANCHORED' badge", () => {
    const { getByText } = renderProofDetail('rec-anchored');
    expect(getByText('ANCHORED')).toBeTruthy();
  });

  it("pending record shows the 'Not yet anchored' chip and no badge", () => {
    const { getByText, queryByText } = renderProofDetail('rec-pending');
    expect(getByText('Not yet anchored')).toBeTruthy();
    expect(queryByText('ANCHORED')).toBeNull();
  });

  it("pressing 'Share proof PDF' invokes the share path", async () => {
    const { getByText } = renderProofDetail('rec-anchored');
    fireEvent.press(getByText('Share proof PDF'));
    await waitFor(() => {
      expect(mockGenerateProofPdf).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockShareProofPdf).toHaveBeenCalledWith('file:///mock-proof.pdf');
    });
  });

  it("pressing 'Back' calls navigation.goBack when canGoBack is true", () => {
    const nav = makeNav();
    nav.canGoBack = jest.fn(() => true);
    const { getByText } = renderProofDetail('rec-anchored', nav);
    fireEvent.press(getByText('Back'));
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  it("missing record renders the 'Proof not found' fallback", () => {
    const { getByText } = renderProofDetail('does-not-exist');
    expect(getByText('Proof not found')).toBeTruthy();
  });

  it("queued record shows 'Queued for chain' chip and 'Retry anchor' button", () => {
    const { getByText, queryByText } = renderProofDetail('rec-queued');
    expect(getByText('Queued for chain')).toBeTruthy();
    expect(getByText('Retry anchor')).toBeTruthy();
    expect(queryByText('ANCHORED')).toBeNull();
    expect(queryByText('Anchor on-chain')).toBeNull();
  });

  it("pressing 'Retry anchor' on queued record calls anchorHash and setAnchored", async () => {
    const { getByText } = renderProofDetail('rec-queued');
    fireEvent.press(getByText('Retry anchor'));
    await waitFor(() => {
      expect(mockAnchorHash).toHaveBeenCalledWith(queuedRec.hash);
    });
    await waitFor(() => {
      expect(mockState.setAnchored).toHaveBeenCalledWith(
        'rec-queued',
        '0xtxhash',
        80002,
      );
    });
  });

  it("'Delete' button opens a confirmation Alert with destructive option", () => {
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const { getByText } = renderProofDetail('rec-anchored');
    fireEvent.press(getByText('Delete'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Delete this proof?');
    // Cancel + Delete (destructive)
    expect(Array.isArray(buttons)).toBe(true);
    const destructive = (buttons as Array<{ style?: string; text: string }>)
      .find((b) => b.style === 'destructive');
    expect(destructive?.text).toBe('Delete');
    alertSpy.mockRestore();
  });

  it("confirming delete invokes remove and navigates back", async () => {
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation((_t, _m, buttons: any) => {
        const destructive = buttons.find((b: any) => b.style === 'destructive');
        destructive.onPress();
      });
    const nav = makeNav();
    const { getByText } = renderProofDetail('rec-anchored', nav);
    fireEvent.press(getByText('Delete'));
    await waitFor(() => {
      expect(mockState.remove).toHaveBeenCalledWith('rec-anchored');
    });
    await waitFor(() => {
      expect(nav.goBack).toHaveBeenCalled();
    });
    alertSpy.mockRestore();
  });

  it("record with no audioUri does NOT render the 'Voice note' section", () => {
    const { queryByText } = renderProofDetail('rec-no-audio');
    expect(queryByText('Voice note')).toBeNull();
  });

  it("record with audioUri DOES render the 'Voice note' section", () => {
    const { getByText } = renderProofDetail('rec-queued');
    expect(getByText('Voice note')).toBeTruthy();
  });
});
