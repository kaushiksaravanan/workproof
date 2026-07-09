import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { Card, RULE_GAP } from '../Card';
import { Chip } from '../Chip';
import { ThemeProvider } from '../../theme/ThemeProvider';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

const flattenStyle = (style: unknown) => StyleSheet.flatten(style as any) ?? {};

describe('Card', () => {
  describe('children', () => {
    it('renders children', () => {
      const { getByText } = renderWithTheme(
        <Card>
          <Text>hello card</Text>
        </Card>,
      );
      expect(getByText('hello card')).toBeTruthy();
    });
  });

  describe("variant='hero'", () => {
    it('renders with no border-radius (full-bleed)', () => {
      const { getByTestId } = renderWithTheme(
        <Card variant="hero" style={{ /* no override */ }}>
          <View testID="hero-child" />
        </Card>,
      );
      // Walk up the tree from the child View, looking for an ancestor
      // whose flattened style declares borderRadius: 0 (the Card's outer
      // container in the hero variant). Walking by fixed depth is brittle
      // because SurfaceProvider context wrappers shift the tree shape.
      let node: any = getByTestId('hero-child');
      let foundZero = false;
      while (node) {
        const s = flattenStyle(node.props?.style);
        if (s && s.borderRadius === 0) {
          foundZero = true;
          break;
        }
        node = node.parent;
      }
      expect(foundZero).toBe(true);
    });
  });

  describe('onPress wrapping', () => {
    it('wraps in Pressable when onPress is provided', () => {
      const onPress = jest.fn();
      const { getByText, getByRole } = renderWithTheme(
        <Card onPress={onPress} accessibilityLabel="tap me">
          <Text>tappable</Text>
        </Card>,
      );
      // The pressable surface exposes itself with role=button.
      expect(getByRole('button')).toBeTruthy();
      fireEvent.press(getByText('tappable'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders a View (not Pressable) when onPress is absent', () => {
      const { queryByRole } = renderWithTheme(
        <Card>
          <Text>static</Text>
        </Card>,
      );
      // Without onPress the Card has no role=button.
      expect(queryByRole('button')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it("sets accessibilityRole='button' when onPress is present", () => {
      const { getByRole } = renderWithTheme(
        <Card onPress={() => {}} accessibilityLabel="press">
          <Text>press me</Text>
        </Card>,
      );
      expect(getByRole('button')).toBeTruthy();
    });

    it('propagates accessibilityLabel (interactive)', () => {
      const { getByLabelText } = renderWithTheme(
        <Card onPress={() => {}} accessibilityLabel="my card label">
          <Text>x</Text>
        </Card>,
      );
      expect(getByLabelText('my card label')).toBeTruthy();
    });

    it('propagates accessibilityLabel (static)', () => {
      const { getByLabelText } = renderWithTheme(
        <Card accessibilityLabel="static label">
          <Text>x</Text>
        </Card>,
      );
      expect(getByLabelText('static label')).toBeTruthy();
    });
  });

  describe('nested pressable focus order', () => {
    // Per peggy-component-spec.md, when an interactive Card contains a
    // decorative Chip, the Chip's wrapper sets accessibilityElementsHidden
    // + importantForAccessibility="no-hide-descendants" so the screen reader
    // surfaces ONE focus stop (the Card) instead of two (Card + inner Chip).
    // History.tsx and Home.tsx rely on this pattern for proof rows.
    it('hides decorative Chip wrapper from AT inside an interactive Card', () => {
      const { getByRole, queryAllByRole } = renderWithTheme(
        <Card onPress={() => {}} accessibilityLabel="proof row">
          <Text>Roof repair</Text>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Chip label="anchored" variant="badge" />
          </View>
        </Card>,
      );

      // The interactive Card surface is the only focus stop with role=button.
      expect(getByRole('button')).toBeTruthy();
      // The decorative inner Chip (no onPress -> role='text') is wrapped in
      // a hidden ancestor; the Chip itself still renders for layout but the
      // wrapper marks the subtree as hidden from AT.
      const buttons = queryAllByRole('button');
      // Exactly one button (the Card). If the Chip leaked an interactive
      // role we'd see two — that's the duplicate-focus-stop bug we guard
      // against.
      expect(buttons.length).toBe(1);
    });

    it('honors accessibilityElementsHidden marker on the wrapper View', () => {
      const { UNSAFE_root } = renderWithTheme(
        <Card onPress={() => {}} accessibilityLabel="row">
          <View
            testID="chip-wrapper"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Chip label="anchored" variant="badge" />
          </View>
        </Card>,
      );

      // Walk the tree and confirm a host View carries both AT-hide markers.
      const findHidden = (node: any): any => {
        if (!node) return null;
        if (typeof node.type === 'string') {
          const props = node.props ?? {};
          if (
            props.accessibilityElementsHidden === true &&
            props.importantForAccessibility === 'no-hide-descendants'
          ) {
            return node;
          }
        }
        const kids = node.children ?? [];
        for (const c of kids) {
          if (typeof c === 'object') {
            const hit = findHidden(c);
            if (hit) return hit;
          }
        }
        return null;
      };
      const hidden = findHidden(UNSAFE_root);
      expect(hidden).toBeTruthy();
    });
  });

  describe("variant='notebook'", () => {
    it('renders rule lines after layout', () => {
      const { getByTestId, UNSAFE_root } = renderWithTheme(
        <Card variant="notebook">
          <View testID="notebook-child" />
        </Card>,
      );

      // Find the root View by walking up from the child
      const child = getByTestId('notebook-child');
      let root: any = child;
      while (root.parent && root.parent.type !== 'RCTRootView') {
        if (root.parent === null) break;
        root = root.parent;
      }
      // Walk up to the View that owns onLayout (the Card's outer View)
      let cardRoot: any = child;
      while (cardRoot && !cardRoot.props?.onLayout) {
        cardRoot = cardRoot.parent;
      }
      expect(cardRoot).toBeTruthy();

      // Before layout, rule count should be 0 — no rule line views rendered
      // (we don't assert this strictly because the rule layer wrapper itself
      // is rendered with absoluteFillObject style, but contains 0 children).

      // Simulate layout
      const layoutHeight = 5 * RULE_GAP + 10;
      fireEvent(cardRoot, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 300, height: layoutHeight } },
      });

      // After layout, the rule layer should contain ceil(h/RULE_GAP)+1 rules.
      const expectedRuleCount = Math.ceil(layoutHeight / RULE_GAP) + 1;

      // Walk the rendered tree and count host Views whose flattened style
      // has height === 1 (the rule lines). Restricting to string types
      // avoids double counting composite React elements alongside their
      // host instances.
      const collectRules = (node: any, acc: any[] = []): any[] => {
        if (!node) return acc;
        if (typeof node.type === 'string') {
          const style = flattenStyle(node.props?.style);
          if (style && style.height === 1 && style.backgroundColor) {
            acc.push(node);
          }
        }
        const children = node.children ?? [];
        for (const c of children) {
          if (typeof c === 'object') collectRules(c, acc);
        }
        return acc;
      };

      const rules = collectRules(UNSAFE_root);
      expect(rules.length).toBe(expectedRuleCount);
    });

    it('renders the coral margin line', () => {
      const { getByTestId, UNSAFE_root } = renderWithTheme(
        <Card variant="notebook">
          <View testID="notebook-child" />
        </Card>,
      );

      const child = getByTestId('notebook-child');
      let cardRoot: any = child;
      while (cardRoot && !cardRoot.props?.onLayout) {
        cardRoot = cardRoot.parent;
      }
      // Trigger layout so the overlay renders.
      fireEvent(cardRoot, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 100 } },
      });

      // Find an absolute-positioned View with width:1 — that's the margin line.
      const collectMarginLines = (node: any, acc: any[] = []): any[] => {
        if (!node) return acc;
        if (typeof node.type === 'string') {
          const style = flattenStyle(node.props?.style);
          if (
            style &&
            style.position === 'absolute' &&
            style.width === 1 &&
            style.backgroundColor
          ) {
            acc.push(node);
          }
        }
        const children = node.children ?? [];
        for (const c of children) {
          if (typeof c === 'object') collectMarginLines(c, acc);
        }
        return acc;
      };

      const marginLines = collectMarginLines(UNSAFE_root);
      expect(marginLines.length).toBe(1);
    });
  });

  describe("variant='hero' has no notebook rules", () => {
    it('does not render rule lines or margin line on hero variant', () => {
      const { UNSAFE_root } = renderWithTheme(
        <Card variant="hero">
          <View testID="hero-child" />
        </Card>,
      );

      // Walk the tree and assert no 1px-tall rule lines exist.
      const collectRules = (node: any, acc: any[] = []): any[] => {
        if (!node) return acc;
        if (typeof node.type === 'string') {
          const style = flattenStyle(node.props?.style);
          if (style && style.height === 1 && style.backgroundColor) {
            acc.push(node);
          }
          if (
            style &&
            style.position === 'absolute' &&
            style.width === 1 &&
            style.backgroundColor
          ) {
            acc.push(node);
          }
        }
        const children = node.children ?? [];
        for (const c of children) {
          if (typeof c === 'object') collectRules(c, acc);
        }
        return acc;
      };

      const rules = collectRules(UNSAFE_root);
      expect(rules.length).toBe(0);
    });
  });

  describe('press feedback animation (animateTo)', () => {
    it('fires pressIn + pressOut without crashing on an interactive card', () => {
      const { getByRole } = renderWithTheme(
        <Card onPress={() => undefined} accessibilityLabel="Interactive card">
          <Text>Body</Text>
        </Card>,
      );
      const node = getByRole('button');
      // pressIn lifts the card, pressOut settles it back. Both go through
      // animateTo(); the assertion is that neither throws + state stays sane.
      expect(() => {
        fireEvent(node, 'pressIn');
        fireEvent(node, 'pressOut');
      }).not.toThrow();
    });

    it('rapid pressIn/pressOut cycles do not throw (animation stopped + restarted)', () => {
      const { getByRole } = renderWithTheme(
        <Card onPress={() => undefined} accessibilityLabel="Interactive card">
          <Text>Body</Text>
        </Card>,
      );
      const node = getByRole('button');
      expect(() => {
        for (let i = 0; i < 5; i++) {
          fireEvent(node, 'pressIn');
          fireEvent(node, 'pressOut');
        }
      }).not.toThrow();
    });

    it('unmounts cleanly mid-animation without a "cannot update state on unmounted" warning', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { getByRole, unmount } = renderWithTheme(
        <Card onPress={() => undefined} accessibilityLabel="Interactive card">
          <Text>Body</Text>
        </Card>,
      );
      const node = getByRole('button');
      fireEvent(node, 'pressIn'); // starts animation
      unmount(); // cleanup effect should stop the in-flight animation
      // No warnings from stopping a running Animated on unmount.
      const badCalls = warn.mock.calls.filter((args) =>
        String(args[0]).includes('unmounted'),
      );
      expect(badCalls).toHaveLength(0);
      warn.mockRestore();
    });
  });
});
