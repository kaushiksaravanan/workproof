import React from 'react';

// --- Native-module mocks (must precede ProofDetail import) ---

jest.mock('expo-av', () => {
  const statusListeners: Array<(s: any) => void> = [];
  class Sound {
    static _instances: Sound[] = [];
    static _createAsyncFactory: (uri: string) => Promise<{ sound: Sound }> =
      async () => ({ sound: new Sound() });
    static createAsync = jest.fn(async (source: any, _opts: any, cb?: any) => {
      const s = new Sound();
      if (cb) statusListeners.push(cb);
      Sound._instances.push(s);
      return Sound._createAsyncFactory(source);
    });
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
    // test-only helper: fire a status event to every registered listener.
    static _emitStatus(s: any): void {
      for (const l of statusListeners) l(s);
    }
    static _reset(): void {
      statusListeners.length = 0;
      Sound._instances.length = 0;
      Sound._createAsyncFactory = async () => ({ sound: new Sound() });
    }
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

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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

  describe('error paths', () => {
    it("share failure surfaces an Alert with the thrown error's message", async () => {
      const alertSpy = jest
        .spyOn(require('react-native').Alert, 'alert')
        .mockImplementation(() => {});
      mockGenerateProofPdf.mockRejectedValueOnce(new Error('PDF gen busted'));
      const { getByText } = renderProofDetail('rec-anchored');

      fireEvent.press(getByText('Share proof PDF'));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Share failed', 'PDF gen busted');
      });
      expect(mockShareProofPdf).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it("share failure with a non-Error throw uses the 'Share failed' fallback", async () => {
      const alertSpy = jest
        .spyOn(require('react-native').Alert, 'alert')
        .mockImplementation(() => {});
      // Reject with a bare string — hits the `!(err instanceof Error)` branch.
      mockGenerateProofPdf.mockImplementationOnce(() =>
        Promise.reject('bare string'),
      );
      const { getByText } = renderProofDetail('rec-anchored');

      fireEvent.press(getByText('Share proof PDF'));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Share failed', 'Share failed');
      });
      alertSpy.mockRestore();
    });

    it("anchor failure surfaces an Alert and doesn't call setAnchored", async () => {
      const alertSpy = jest
        .spyOn(require('react-native').Alert, 'alert')
        .mockImplementation(() => {});
      mockAnchorHash.mockRejectedValueOnce(new Error('RPC unreachable'));
      const { getByText } = renderProofDetail('rec-queued');

      // rec-queued renders 'Retry anchor'.
      fireEvent.press(getByText('Retry anchor'));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Anchor failed',
          'RPC unreachable',
        );
      });
      expect(mockState.setAnchored).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it("delete failure surfaces an Alert and keeps the user on the screen", async () => {
      const alertMock = jest.fn();
      const alertSpy = jest
        .spyOn(require('react-native').Alert, 'alert')
        .mockImplementation(alertMock);
      const nav = makeNav();
      mockState.remove.mockRejectedValueOnce(new Error('disk offline'));

      const { getByText } = renderProofDetail('rec-anchored', nav);
      fireEvent.press(getByText('Delete'));

      // First Alert is the confirmation. Grab its destructive button.
      expect(alertMock).toHaveBeenCalledTimes(1);
      const [, , buttons] = alertMock.mock.calls[0];
      const destructive = (
        buttons as Array<{ style?: string; onPress?: () => Promise<void> }>
      ).find((b) => b.style === 'destructive');
      await destructive?.onPress?.();

      // Second Alert is the failure surface.
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledTimes(2);
      });
      expect(alertMock.mock.calls[1][0]).toBe('Delete failed');
      expect(alertMock.mock.calls[1][1]).toBe('disk offline');
      // The failure must NOT navigate away.
      expect(nav.goBack).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });

  describe('AudioPlayer (useEffect + onToggle)', () => {
    const { Audio } = require('expo-av') as {
      Audio: {
        Sound: {
          createAsync: jest.Mock;
          _emitStatus(s: any): void;
          _reset(): void;
          _createAsyncFactory: (uri: string) => Promise<unknown>;
        };
        setAudioModeAsync: jest.Mock;
      };
    };

    beforeEach(() => {
      Audio.Sound._reset();
      Audio.Sound.createAsync.mockClear();
      Audio.setAudioModeAsync.mockClear();
    });

    it("calls Audio.setAudioModeAsync + Sound.createAsync when mounting a record with audioUri", async () => {
      renderProofDetail('rec-queued');
      await waitFor(() => {
        expect(Audio.setAudioModeAsync).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(Audio.Sound.createAsync).toHaveBeenCalled();
      });
    });

    it('status callback with isPlaying=true updates the toggle label to Pause', async () => {
      const { getByLabelText } = renderProofDetail('rec-queued');
      await waitFor(() => {
        expect(Audio.Sound.createAsync).toHaveBeenCalled();
      });
      await new Promise((r) => setTimeout(r, 0));
      await act(async () => {
        Audio.Sound._emitStatus({
          isLoaded: true,
          isPlaying: true,
          durationMillis: 2000,
          positionMillis: 500,
          didJustFinish: false,
        });
      });
      expect(getByLabelText('Pause audio')).toBeTruthy();
    });

    it('didJustFinish status resets play state and progress to 0', async () => {
      const { getByLabelText } = renderProofDetail('rec-queued');
      await waitFor(() => {
        expect(Audio.Sound.createAsync).toHaveBeenCalled();
      });
      await new Promise((r) => setTimeout(r, 0));
      await act(async () => {
        Audio.Sound._emitStatus({
          isLoaded: true,
          isPlaying: true,
          durationMillis: 2000,
          positionMillis: 2000,
          didJustFinish: true,
        });
      });
      expect(getByLabelText('Play audio')).toBeTruthy();
    });

    it('status callback with isLoaded=false is a no-op (no state update)', async () => {
      const { getByLabelText } = renderProofDetail('rec-queued');
      await waitFor(() => {
        expect(Audio.Sound.createAsync).toHaveBeenCalled();
      });
      await new Promise((r) => setTimeout(r, 0));
      await act(async () => {
        Audio.Sound._emitStatus({ isLoaded: false });
      });
      expect(getByLabelText('Play audio')).toBeTruthy();
    });

    it("createAsync failure announces 'Audio failed to load' and disables the toggle", async () => {
      Audio.Sound._createAsyncFactory = () =>
        Promise.reject(new Error('load busted'));
      const announceSpy = jest.spyOn(
        require('react-native').AccessibilityInfo,
        'announceForAccessibility',
      );
      const { getByLabelText } = renderProofDetail('rec-queued');
      await waitFor(() => {
        expect(announceSpy).toHaveBeenCalledWith('Audio failed to load');
      });
      const toggle = getByLabelText('Play audio');
      expect(toggle.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true }),
      );
      announceSpy.mockRestore();
    });
  });
});
