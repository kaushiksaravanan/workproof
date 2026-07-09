import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { History } from '../History';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { WorkRecord } from '../../types';

// --- Mock the work store --------------------------------------------------
// Two fixture records: one anchored, one pending. The store is a hook in the
// real app; we replace it with a stateful jest mock so each test can swap the
// records list. Selectors (s) => s.records are honoured by passing the same
// state object to the selector function.

const anchoredRecord: WorkRecord = {
  id: 'rec-anchored-1',
  createdAt: '2026-06-20T10:00:00.000Z',
  workType: 'Roof repair',
  clientName: 'Asha Sharma',
  amountReceived: 5000,
  amountPending: 0,
  photoUri: '',
  transcript: 'Fixed two tiles on the south side.',
  hash: '0xabcdef0123456789aaaabbbbccccdddd',
  anchorTxHash: '0x1111222233334444',
  anchorChainId: 137,
};

const pendingRecord: WorkRecord = {
  id: 'rec-pending-1',
  createdAt: '2026-06-19T08:30:00.000Z',
  workType: 'Garden cleanup',
  clientName: 'Ravi Mehta',
  amountReceived: 1200,
  amountPending: 800,
  photoUri: '',
  transcript: 'Trimmed hedges, hauled away two bags.',
  hash: '0xfeedfacecafebeefdeadbeef00000000',
  // no anchorTxHash / anchorChainId => pending
};

interface MockState {
  records: WorkRecord[];
  loading: boolean;
  error: string | null;
  hasHydrated: boolean;
  refresh: jest.Mock;
  upsert: jest.Mock;
  remove: jest.Mock;
  setAnchored: jest.Mock;
  clearError: jest.Mock;
}

let mockState: MockState;

function makeMockState(overrides: Partial<MockState> = {}): MockState {
  return {
    records: [anchoredRecord, pendingRecord],
    loading: false,
    error: null,
    hasHydrated: true,
    refresh: jest.fn(),
    upsert: jest.fn(),
    remove: jest.fn(),
    setAnchored: jest.fn(),
    clearError: jest.fn(),
    ...overrides,
  };
}

jest.mock('../../state/workStore', () => ({
  useWorkStore: <T,>(selector?: (s: MockState) => T): T | MockState => {
    if (typeof selector === 'function') return selector(mockState);
    return mockState;
  },
}));

// --- Helpers --------------------------------------------------------------

function renderHistory(
  onOpenProof: (record: WorkRecord) => void = jest.fn(),
) {
  return render(
    <ThemeProvider>
      <History onOpenProof={onOpenProof} />
    </ThemeProvider>,
  );
}

// --- Tests ----------------------------------------------------------------

describe('History screen', () => {
  beforeEach(() => {
    mockState = makeMockState();
  });

  it('renders SegmentedTabs filter with All / Pending / Anchored labels', () => {
    const { getAllByRole, getByText } = renderHistory();
    const tabs = getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(getByText('All')).toBeTruthy();
    expect(getByText('Pending')).toBeTruthy();
    expect(getByText('Anchored')).toBeTruthy();
  });

  it("default 'All' view shows both anchored and pending records", () => {
    const { getByText } = renderHistory();
    expect(getByText('Roof repair')).toBeTruthy();
    expect(getByText('Garden cleanup')).toBeTruthy();
  });

  it("tapping 'Pending' filters to only the pending record", () => {
    const { getAllByRole, getByText, queryByText } = renderHistory();
    const tabs = getAllByRole('tab');
    // tabs order matches TABS in History.tsx: all, pending, anchored
    fireEvent.press(tabs[1]);

    expect(getByText('Garden cleanup')).toBeTruthy();
    expect(queryByText('Roof repair')).toBeNull();
  });

  it("tapping 'Anchored' filters to only the anchored record", () => {
    const { getAllByRole, getByText, queryByText } = renderHistory();
    const tabs = getAllByRole('tab');
    fireEvent.press(tabs[2]);

    expect(getByText('Roof repair')).toBeTruthy();
    expect(queryByText('Garden cleanup')).toBeNull();
  });

  it('pressing a record card calls onOpenProof with that record', () => {
    const onOpenProof = jest.fn();
    const { getByText } = renderHistory(onOpenProof);

    // The Card wraps its children in a Pressable with role=button. Pressing
    // any descendant text propagates the onPress.
    fireEvent.press(getByText('Roof repair'));
    expect(onOpenProof).toHaveBeenCalledTimes(1);
    expect(onOpenProof).toHaveBeenCalledWith(anchoredRecord);

    fireEvent.press(getByText('Garden cleanup'));
    expect(onOpenProof).toHaveBeenCalledTimes(2);
    expect(onOpenProof).toHaveBeenLastCalledWith(pendingRecord);
  });

  it('shows the empty state after hydration completes when records is empty', () => {
    mockState = makeMockState({ records: [], hasHydrated: true });
    const { getByText, queryByText } = renderHistory();

    // EMPTY_COPY.all.title
    expect(getByText('No proofs yet')).toBeTruthy();
    expect(
      getByText('Record your first job and it lands here, signed and ready.'),
    ).toBeTruthy();
    // The pre-hydration loading copy must NOT be visible.
    expect(queryByText('Loading your proofs…')).toBeNull();
  });

  it('shows the pending-filter empty copy when no pending records exist', () => {
    mockState = makeMockState({ records: [anchoredRecord], hasHydrated: true });
    const { getAllByRole, getByText, queryByText } = renderHistory();
    fireEvent.press(getAllByRole('tab')[1]);
    expect(getByText('Nothing pending')).toBeTruthy();
    expect(
      getByText('Every proof you have made is anchored on-chain.'),
    ).toBeTruthy();
    // Wrong-filter copy must not appear.
    expect(queryByText('Nothing anchored')).toBeNull();
    expect(queryByText('No proofs yet')).toBeNull();
  });

  it('shows the anchored-filter empty copy when no anchored records exist', () => {
    mockState = makeMockState({ records: [pendingRecord], hasHydrated: true });
    const { getAllByRole, getByText, queryByText } = renderHistory();
    fireEvent.press(getAllByRole('tab')[2]);
    expect(getByText('Nothing anchored')).toBeTruthy();
    expect(
      getByText('Save a proof and tap Anchor to put it on-chain.'),
    ).toBeTruthy();
    expect(queryByText('Nothing pending')).toBeNull();
  });

  it('shows the pre-hydration loading state instead of empty copy', () => {
    mockState = makeMockState({ records: [], hasHydrated: false });
    const { getByText, queryByText } = renderHistory();
    expect(getByText('Loading your proofs…')).toBeTruthy();
    // The "no proofs yet" copy must not flash before AsyncStorage hydrates.
    expect(queryByText('No proofs yet')).toBeNull();
  });

  it('renders the error banner and dismisses it via clearError + AT announce', () => {
    const clearError = jest.fn();
    mockState = makeMockState({
      error: 'Could not save the proof',
      clearError,
    });
    const announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);

    const { getByText, getByLabelText } = renderHistory();
    expect(getByText('Could not save the proof')).toBeTruthy();

    fireEvent.press(getByLabelText('Dismiss error'));
    expect(clearError).toHaveBeenCalledTimes(1);
    expect(announceSpy).toHaveBeenCalledWith('Error dismissed');

    announceSpy.mockRestore();
  });

  it('omits the error banner entirely when error is null', () => {
    mockState = makeMockState({ error: null });
    const { queryByLabelText } = renderHistory();
    expect(queryByLabelText('Dismiss error')).toBeNull();
  });

  it('wires RefreshControl: pull-to-refresh calls store.refresh, loading reflects state', () => {
    const refresh = jest.fn();
    mockState = makeMockState({ refresh, loading: false });
    const { UNSAFE_getByType, rerender } = renderHistory();
    const { RefreshControl } = require('react-native');
    const rc = UNSAFE_getByType(RefreshControl);
    expect(rc.props.refreshing).toBe(false);
    rc.props.onRefresh();
    expect(refresh).toHaveBeenCalledTimes(1);

    // Flip loading=true and re-render — RefreshControl reflects spinner state.
    mockState = makeMockState({ refresh, loading: true });
    rerender(
      <ThemeProvider>
        <History onOpenProof={jest.fn()} />
      </ThemeProvider>,
    );
    const rc2 = UNSAFE_getByType(RefreshControl);
    expect(rc2.props.refreshing).toBe(true);
  });

  it("falls back to 'Untitled work' in the a11y label when workType is empty", () => {
    // A record missing workType (e.g. saved before the field was added, or an
    // extraction pipeline that failed to identify one). The renderItem
    // accessibilityLabel should still be well-formed.
    const noTitle: WorkRecord = {
      ...anchoredRecord,
      id: 'rec-untitled',
      workType: '',
      clientName: '',
    };
    mockState = makeMockState({ records: [noTitle] });
    const { getByLabelText } = renderHistory();
    // Label pattern: `<workType>, <amount>, <chipLabel>` — no clientName
    // segment when clientName is empty.
    expect(getByLabelText(/Untitled work.*Anchored/)).toBeTruthy();
  });
});

describe('isHistoryFilter — filter-key type guard', () => {
  const { isHistoryFilter } = require('../History') as {
    isHistoryFilter: (v: string) => boolean;
  };

  it.each(['all', 'pending', 'anchored'])(
    "returns true for the canonical filter '%s'",
    (key) => {
      expect(isHistoryFilter(key)).toBe(true);
    },
  );

  it.each(['ALL', 'Pending', ' anchored ', 'archived', '', '__proto__'])(
    "returns false for the unknown value %j",
    (key) => {
      expect(isHistoryFilter(key as string)).toBe(false);
    },
  );
});
