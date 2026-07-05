import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

import { ScreenScaffold } from '../ScreenScaffold';
import { ThemeProvider } from '../../theme/ThemeProvider';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe('ScreenScaffold', () => {
  it('renders children inside a ScrollView by default', () => {
    const { UNSAFE_queryByType, getByText } = renderWithTheme(
      <ScreenScaffold>
        <Text>scaffold-child</Text>
      </ScreenScaffold>,
    );
    expect(getByText('scaffold-child')).toBeTruthy();
    expect(UNSAFE_queryByType(ScrollView)).not.toBeNull();
  });

  it('does NOT render a ScrollView when scrollable={false}', () => {
    const { UNSAFE_queryByType, getByText } = renderWithTheme(
      <ScreenScaffold scrollable={false}>
        <Text>fixed-child</Text>
      </ScreenScaffold>,
    );
    expect(getByText('fixed-child')).toBeTruthy();
    expect(UNSAFE_queryByType(ScrollView)).toBeNull();
  });

  it('forwards refreshControl to the underlying ScrollView', () => {
    const refreshEl = (
      <RefreshControl refreshing={false} onRefresh={() => undefined} />
    );
    const { UNSAFE_getByType } = renderWithTheme(
      <ScreenScaffold refreshControl={refreshEl}>
        <Text>with-refresh</Text>
      </ScreenScaffold>,
    );
    const scroll = UNSAFE_getByType(ScrollView);
    expect(scroll.props.refreshControl).toBe(refreshEl);
  });

  it('renders a hero slot above the content when provided', () => {
    const { getByTestId } = renderWithTheme(
      <ScreenScaffold hero={<View testID="hero-content" />}>
        <Text>body</Text>
      </ScreenScaffold>,
    );
    expect(getByTestId('hero-content')).toBeTruthy();
  });

  it('passes edges down to SafeAreaView', () => {
    const edges = ['bottom', 'left', 'right'] as const;
    const { UNSAFE_root } = renderWithTheme(
      <ScreenScaffold testID="scaffold-root" edges={edges}>
        <Text>edged</Text>
      </ScreenScaffold>,
    );
    // Walk the tree to find the node carrying our testID; assert it received edges.
    const found = UNSAFE_root.findAll(
      (n: { props?: Record<string, unknown> }) =>
        !!n.props && n.props.testID === 'scaffold-root',
    );
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].props.edges).toEqual(edges);
  });
});
