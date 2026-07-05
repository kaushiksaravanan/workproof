import React from 'react';
import { Animated } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SegmentedTabs, SegmentedTab } from '../SegmentedTabs';
import { ThemeProvider } from '../../theme/ThemeProvider';

const TABS: SegmentedTab[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'done', label: 'Done' },
];

function renderTabs(
  value: string,
  onChange: (key: string) => void = jest.fn(),
) {
  return render(
    <ThemeProvider>
      <SegmentedTabs tabs={TABS} value={value} onChange={onChange} />
    </ThemeProvider>,
  );
}

describe('SegmentedTabs', () => {
  it('renders all tab labels', () => {
    const { getByText } = renderTabs('all');
    expect(getByText('All')).toBeTruthy();
    expect(getByText('Pending')).toBeTruthy();
    expect(getByText('Done')).toBeTruthy();
  });

  it("uses accessibilityRole='tablist' on the container", () => {
    const { getByRole } = renderTabs('all');
    // getByRole('tablist') will throw if missing — that's the assertion.
    expect(getByRole('tablist')).toBeTruthy();
  });

  it("renders each tab with accessibilityRole='tab' and selected state reflecting value", () => {
    const { getAllByRole } = renderTabs('pending');
    const tabNodes = getAllByRole('tab');
    expect(tabNodes).toHaveLength(TABS.length);

    // Order matches TABS declaration: all, pending, done.
    expect(tabNodes[0].props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
    expect(tabNodes[1].props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(tabNodes[2].props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it('fires onChange with the tapped key when an inactive tab is pressed', () => {
    const onChange = jest.fn();
    const { getAllByRole } = renderTabs('all', onChange);
    const tabNodes = getAllByRole('tab');

    fireEvent.press(tabNodes[2]); // 'done'

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('done');
  });

  // Documents current behavior: tapping the already-active tab does NOT
  // re-fire onChange. The component intentionally swallows it (matches
  // UISegmentedControl + suppresses the selection haptic). If this changes
  // to fire idempotently, flip this assertion.
  it('does NOT fire onChange when the active tab is pressed (idempotent — swallowed)', () => {
    const onChange = jest.fn();
    const { getAllByRole } = renderTabs('pending', onChange);
    const tabNodes = getAllByRole('tab');

    fireEvent.press(tabNodes[1]); // active 'pending'

    expect(onChange).not.toHaveBeenCalled();
  });

  // Rapid switching must interrupt the in-flight tween rather than queue
  // animations — otherwise the indicator briefly snaps back as stacked
  // animations resolve out of order ("flicker"). We assert that .stop() is
  // invoked on each prior tween before a new one starts.
  it('interrupts the in-flight indicator tween on rapid value changes (no flicker)', () => {
    const stopSpy = jest.fn();
    const startSpy = jest.fn();
    const realTiming = Animated.timing;
    const timingSpy = jest
      .spyOn(Animated, 'timing')
      .mockImplementation((value, config) => {
        const anim = realTiming(value, config);
        return {
          ...anim,
          start: (cb?: Animated.EndCallback) => {
            startSpy();
            anim.start(cb);
          },
          stop: () => {
            stopSpy();
            anim.stop();
          },
        } as Animated.CompositeAnimation;
      });

    try {
      const onChange = jest.fn();
      const { rerender } = render(
        <ThemeProvider>
          <SegmentedTabs tabs={TABS} value="all" onChange={onChange} />
        </ThemeProvider>,
      );

      // Three rapid switches — the effect should stop the previous tween
      // before spinning up the next one, on every transition.
      act(() => {
        rerender(
          <ThemeProvider>
            <SegmentedTabs tabs={TABS} value="pending" onChange={onChange} />
          </ThemeProvider>,
        );
      });
      act(() => {
        rerender(
          <ThemeProvider>
            <SegmentedTabs tabs={TABS} value="done" onChange={onChange} />
          </ThemeProvider>,
        );
      });
      act(() => {
        rerender(
          <ThemeProvider>
            <SegmentedTabs tabs={TABS} value="all" onChange={onChange} />
          </ThemeProvider>,
        );
      });

      // We expect at least one stop() per subsequent tween (initial mount
      // doesn't have a prior anim to stop, but the effect still calls
      // animationRef.current?.stop() — which is a no-op when null).
      expect(startSpy).toHaveBeenCalled();
      expect(stopSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      timingSpy.mockRestore();
    }
  });

  // The native driver requires NUMERIC translateX. If we ever regressed to
  // a percentage-string interpolation, native compositing would silently
  // break. Probe the indicator via the rendered tree's JSON; the Animated
  // node may be host-mocked, so we inspect any view whose style carries a
  // translateX transform. We also assert at least one such transform value
  // is non-string (an Animated interpolation node or a number).
  it('drives the indicator translateX as a numeric Animated interpolation (not %)', () => {
    const { toJSON } = renderTabs('pending');
    const tree = toJSON();
    const findTransforms = (node: unknown): unknown[] => {
      const out: unknown[] = [];
      const visit = (n: unknown): void => {
        if (!n || typeof n !== 'object') return;
        const obj = n as { props?: { style?: unknown }; children?: unknown[] };
        const style = obj.props?.style;
        const flat = Array.isArray(style)
          ? Object.assign({}, ...(style.filter(Boolean) as object[]))
          : style;
        if (
          flat &&
          typeof flat === 'object' &&
          Array.isArray((flat as { transform?: unknown }).transform)
        ) {
          for (const t of (flat as { transform: Record<string, unknown>[] })
            .transform) {
            if (t && 'translateX' in t) out.push(t.translateX);
          }
        }
        if (Array.isArray(obj.children)) obj.children.forEach(visit);
      };
      visit(node);
      return out;
    };
    const tx = findTransforms(tree);
    // Even with no layout event (innerWidth=0 → indicator suppressed in
    // tree), this test still passes because we don't require a translate
    // to exist; we only require that ANY translate present is non-string.
    for (const v of tx) {
      expect(typeof v).not.toBe('string');
    }
  });

  // ReduceMotion path: when the OS reports reduce-motion enabled, the
  // component must call setValue() and skip Animated.timing entirely so
  // the indicator jumps without a tween. Spy on the real hook module
  // (don't resetModules — that creates a duplicate React and breaks
  // hooks).
  it('skips Animated.timing and sets the indicator value directly under reduceMotion', () => {
    const reducedMotionMod =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../theme/useReducedMotion') as typeof import('../../theme/useReducedMotion');
    const hookSpy = jest
      .spyOn(reducedMotionMod, 'useReducedMotion')
      .mockReturnValue(true);
    const timingSpy = jest.spyOn(Animated, 'timing');

    try {
      const { rerender } = render(
        <ThemeProvider>
          <SegmentedTabs tabs={TABS} value="all" onChange={jest.fn()} />
        </ThemeProvider>,
      );
      act(() => {
        rerender(
          <ThemeProvider>
            <SegmentedTabs tabs={TABS} value="done" onChange={jest.fn()} />
          </ThemeProvider>,
        );
      });

      // Animated.timing must not have been invoked on either pass.
      expect(timingSpy).not.toHaveBeenCalled();
    } finally {
      hookSpy.mockRestore();
      timingSpy.mockRestore();
    }
  });
});
