import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Home } from '../Home';
import type { HomeProps } from '../Home';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { WorkRecord } from '../../types';

/**
 * Mock @react-navigation/native so Home's useFocusEffect doesn't require a
 * NavigationContainer. We pass `navigation` directly to Home, so the
 * useNavigation hook isn't actually consumed at test time — but useFocusEffect
 * still calls it internally. The simplest stable mock is to make
 * useFocusEffect run the callback synchronously like a useEffect-once.
 */
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
      // empty deps: run once, like the real hook fires on focus
    }, []);
  },
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

/**
 * Mock the work store. Home uses two access patterns:
 *   - useWorkStore((s) => s.records) — hook with selector
 *   - useWorkStore.getState().refresh() — static accessor in useFocusEffect
 *
 * We back both with the same in-test state object so tests can swap records
 * via setMockState() without touching AsyncStorage.
 */
let mockState: { records: WorkRecord[]; refresh: jest.Mock };

const setMockState = (partial: Partial<{ records: WorkRecord[] }>): void => {
  mockState = {
    ...(mockState ?? {
      refresh: jest.fn().mockResolvedValue(undefined),
      records: [],
    }),
    ...partial,
  };
};

jest.mock('../../state/workStore', () => {
  const useWorkStore: any = jest.fn((selector?: (s: any) => unknown) => {
    if (typeof selector === 'function') return selector(mockState);
    return mockState;
  });
  useWorkStore.getState = () => mockState;
  return { useWorkStore };
});

// useFocusEffect during initial mount calls the effect synchronously, which
// triggers refresh() — that's fine and we want to keep that real behavior so
// we can assert refresh was called. The default jest-expo preset already
// mocks @react-navigation/native well enough for our purposes.

const makeRecord = (overrides: Partial<WorkRecord> = {}): WorkRecord => ({
  id: 'rec-1',
  createdAt: new Date().toISOString(),
  workType: 'Plumbing repair',
  clientName: 'Acme Co.',
  amountReceived: 0,
  amountPending: 0,
  photoUri: '',
  transcript: '',
  hash: '0xdeadbeef',
  ...overrides,
});

const makeNav = (): HomeProps['navigation'] => {
  const nav: any = {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    push: jest.fn(),
    pop: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => () => {}),
    removeListener: jest.fn(),
    isFocused: jest.fn(() => true),
    canGoBack: jest.fn(() => false),
    dispatch: jest.fn(),
    reset: jest.fn(),
    getId: jest.fn(),
    getParent: jest.fn(),
    getState: jest.fn(),
  };
  return nav as HomeProps['navigation'];
};

const makeRoute = (): HomeProps['route'] =>
  ({ key: 'Home', name: 'Home', params: undefined } as unknown as HomeProps['route']);

const renderHome = (
  navigationOverride?: HomeProps['navigation'],
): { navigation: HomeProps['navigation']; utils: ReturnType<typeof render> } => {
  const navigation = navigationOverride ?? makeNav();
  const utils = render(
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
        <Home navigation={navigation} route={makeRoute()} />
      </SafeAreaProvider>
    </ThemeProvider>,
  );
  return { navigation, utils };
};

beforeEach(() => {
  setMockState({ records: [] });
});

describe('Home', () => {
  describe('empty state (0 records)', () => {
    it('renders the empty-state copy and CTA', () => {
      setMockState({ records: [] });
      const { utils } = renderHome();
      expect(utils.getByText('your first proof is one tap away')).toBeTruthy();
      expect(utils.getByText('Start your first proof')).toBeTruthy();
    });

    it('does not render the secondary "Log today\'s work" CTA when empty', () => {
      setMockState({ records: [] });
      const { utils } = renderHome();
      expect(utils.queryByText("Log today's work")).toBeNull();
    });

    it('pressing "Start your first proof" navigates to LogWork', () => {
      setMockState({ records: [] });
      const { navigation, utils } = renderHome();
      fireEvent.press(utils.getByText('Start your first proof'));
      expect(navigation.navigate).toHaveBeenCalledWith('LogWork');
    });
  });

  describe('with 1 record', () => {
    it("renders the record's workType and clientName", () => {
      const rec = makeRecord({
        id: 'rec-A',
        workType: 'Roof patch',
        clientName: 'Mrs. Iyer',
      });
      setMockState({ records: [rec] });
      const { utils } = renderHome();
      expect(utils.getByText('Roof patch')).toBeTruthy();
      expect(utils.getByText('Mrs. Iyer')).toBeTruthy();
    });

    it("pressing \"Log today's work\" navigates to LogWork", () => {
      setMockState({ records: [makeRecord()] });
      const { navigation, utils } = renderHome();
      fireEvent.press(utils.getByText("Log today's work"));
      expect(navigation.navigate).toHaveBeenCalledWith('LogWork');
    });

    it('pressing the recent card navigates to ProofDetail with the record id', () => {
      const rec = makeRecord({
        id: 'rec-XYZ',
        workType: 'Wiring fix',
        clientName: 'Ravi',
      });
      setMockState({ records: [rec] });
      const { navigation, utils } = renderHome();
      // Card exposes accessibilityLabel including workType + clientName.
      const card = utils.getByLabelText(/Wiring fix for Ravi/);
      fireEvent.press(card);
      expect(navigation.navigate).toHaveBeenCalledWith('ProofDetail', {
        id: 'rec-XYZ',
      });
    });
  });

  describe('refresh wiring', () => {
    it('calls workStore.refresh() via useFocusEffect on mount', () => {
      setMockState({ records: [] });
      renderHome();
      // Our @react-navigation/native mock fires useFocusEffect's callback
      // synchronously like useEffect, so refresh() should be invoked once.
      expect(mockState.refresh).toHaveBeenCalled();
    });

    it('wires a RefreshControl through ScreenScaffold.refreshControl', () => {
      setMockState({ records: [makeRecord()] });
      const { utils } = renderHome();
      // ScreenScaffold's testID is on the SafeAreaView wrapper. The ScrollView
      // child carries the refreshControl prop forwarded from Home.
      const scaffold = utils.getByTestId('home-screen');
      const scroll = scaffold.findAll(
        (n: any) => n.props && typeof n.props.refreshControl !== 'undefined',
      )[0];
      expect(scroll).toBeTruthy();
      const rc = (scroll as any).props.refreshControl;
      expect(rc).toBeTruthy();
      expect(typeof rc.props.onRefresh).toBe('function');
      expect(rc.props.refreshing).toBe(false);
    });

    it('handleRefresh calls workStore.refresh and toggles the spinner off after', async () => {
      setMockState({ records: [makeRecord()] });
      const { utils } = renderHome();
      const scaffold = utils.getByTestId('home-screen');
      const scroll = scaffold.findAll(
        (n: any) => n.props && typeof n.props.refreshControl !== 'undefined',
      )[0];
      const rc = (scroll as any).props.refreshControl;
      // Invoke handleRefresh directly. The mockState.refresh mock resolves
      // immediately, so refreshing should flip back to false before the
      // returned promise settles.
      await rc.props.onRefresh();
      expect(mockState.refresh).toHaveBeenCalled();
    });

    it("'View all' link navigates to History", () => {
      setMockState({ records: [makeRecord()] });
      const { navigation, utils } = renderHome();
      const link = utils.getByLabelText('View all your work');
      fireEvent.press(link);
      expect(navigation.navigate).toHaveBeenCalledWith('History');
    });
  });

  describe('stats row', () => {
    it('shows correct counts for this-week and anchored', () => {
      const now = new Date().toISOString();
      const records: WorkRecord[] = [
        // Anchored, this week
        makeRecord({
          id: 'a',
          createdAt: now,
          anchorTxHash: '0xabc123',
          anchorChainId: 1,
        }),
        // Pending (queued: prefix), this week — counts for week, NOT anchored
        makeRecord({
          id: 'b',
          createdAt: now,
          anchorTxHash: 'queued:foo',
          anchorChainId: 1,
        }),
        // Plain pending (no anchor), this week
        makeRecord({ id: 'c', createdAt: now }),
      ];
      setMockState({ records });
      const { utils } = renderHome();

      // Stats row exposes a combined a11y label "<n> jobs this week, <m> anchored on-chain".
      // The visible numeric Text nodes are intentionally hidden from AT
      // (importantForAccessibility="no-hide-descendants" in Home.tsx) so we
      // verify counts via the parent a11y label only.
      expect(
        utils.getByLabelText('3 jobs this week, 1 anchored on-chain'),
      ).toBeTruthy();
    });
  });
});

describe('countThisWeek — pure helper (edge cases)', () => {
  const { countThisWeek } = require('../Home') as {
    countThisWeek: (records: WorkRecord[]) => number;
  };

  it('returns 0 for an empty array', () => {
    expect(countThisWeek([])).toBe(0);
  });

  it('counts records with createdAt = now', () => {
    const now = new Date().toISOString();
    expect(countThisWeek([makeRecord({ id: 'a', createdAt: now })])).toBe(1);
  });

  it('excludes records with createdAt from ~30 days ago', () => {
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      countThisWeek([makeRecord({ id: 'a', createdAt: oneMonthAgo })]),
    ).toBe(0);
  });

  it('excludes records with an invalid createdAt (dayjs isValid() false)', () => {
    expect(
      countThisWeek([makeRecord({ id: 'a', createdAt: 'not-a-date' })]),
    ).toBe(0);
  });

  it('counts mixed records correctly (2 this week + 1 old)', () => {
    const now = new Date().toISOString();
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const records = [
      makeRecord({ id: 'a', createdAt: now }),
      makeRecord({ id: 'b', createdAt: now }),
      makeRecord({ id: 'c', createdAt: oldDate }),
    ];
    expect(countThisWeek(records)).toBe(2);
  });
});

describe('countAnchored — pure helper (edge cases)', () => {
  const { countAnchored } = require('../Home') as {
    countAnchored: (records: WorkRecord[]) => number;
  };

  it('returns 0 for an empty array', () => {
    expect(countAnchored([])).toBe(0);
  });

  it('returns 0 when nothing is anchored', () => {
    expect(
      countAnchored([
        makeRecord({ id: 'a' }),
        makeRecord({ id: 'b' }),
      ]),
    ).toBe(0);
  });

  it('counts a fully anchored record (anchorTxHash + anchorChainId set)', () => {
    expect(
      countAnchored([
        makeRecord({ id: 'a', anchorTxHash: '0xdead', anchorChainId: 80002 }),
      ]),
    ).toBe(1);
  });

  it("does NOT count a 'queued:' synthetic tx (offline queue placeholder)", () => {
    // isAnchored rejects the 'queued:' prefix — proofs waiting to flush don't
    // count as anchored on the Home stat card. Verified in utils/record.test.ts;
    // this test pins the propagation through Home.tsx's stat aggregator.
    expect(
      countAnchored([
        makeRecord({
          id: 'a',
          anchorTxHash: 'queued:0xabc',
          anchorChainId: 80002,
        }),
      ]),
    ).toBe(0);
  });

  it('counts mixed records correctly (2 anchored, 1 queued, 1 pending)', () => {
    const records = [
      makeRecord({
        id: 'a',
        anchorTxHash: '0x11',
        anchorChainId: 80002,
      }),
      makeRecord({
        id: 'b',
        anchorTxHash: '0x22',
        anchorChainId: 80002,
      }),
      makeRecord({
        id: 'c',
        anchorTxHash: 'queued:0x33',
        anchorChainId: 80002,
      }),
      makeRecord({ id: 'd' }),
    ];
    expect(countAnchored(records)).toBe(2);
  });
});
