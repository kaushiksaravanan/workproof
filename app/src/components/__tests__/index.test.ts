/**
 * The components barrel re-exports every public component + type. This spec
 * pins the exported symbols so accidental removals show up as a failing
 * test rather than a silent breaking change for consumers.
 */

import * as Barrel from '../index';

describe('src/components/index.ts — barrel exports', () => {
  it.each([
    'Button',
    'Card',
    'Chip',
    'Doodle',
    'MarkerUnderline',
    'PaperPlane',
    'ScreenScaffold',
    'SegmentedTabs',
  ])("exports '%s' as a truthy value (component identity check)", (name) => {
    expect((Barrel as Record<string, unknown>)[name]).toBeTruthy();
    // React components are functions (or memo-wrapped objects with a $$typeof).
    const v = (Barrel as Record<string, unknown>)[name];
    const isCallable = typeof v === 'function' || (v !== null && typeof v === 'object');
    expect(isCallable).toBe(true);
  });

  it('exports exactly the expected 8 named values (no accidental additions)', () => {
    const expected = [
      'Button',
      'Card',
      'Chip',
      'Doodle',
      'MarkerUnderline',
      'PaperPlane',
      'ScreenScaffold',
      'SegmentedTabs',
    ].sort();
    const actual = Object.keys(Barrel).sort();
    expect(actual).toEqual(expected);
  });
});
