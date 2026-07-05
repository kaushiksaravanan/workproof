import React from 'react';
import { render } from '@testing-library/react-native';

import { Doodle } from '../Doodle';
import { SurfaceProvider } from '../../theme/SurfaceContext';

describe('Doodle', () => {
  describe('accessibility — decorative by default', () => {
    it('hides itself from screen readers when no accessibilityLabel is provided', () => {
      const { UNSAFE_getByType } = render(<Doodle variant="mom" />);
      // react-native-image instance — read accessibility props
      const Image = require('react-native').Image;
      const img = UNSAFE_getByType(Image);
      expect(img.props.accessible).toBe(false);
      expect(img.props.accessibilityElementsHidden).toBe(true);
      expect(img.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(img.props.accessibilityRole).toBeUndefined();
      expect(img.props.accessibilityLabel).toBeUndefined();
    });
  });

  describe('accessibility — labeled', () => {
    it('exposes itself as an image with the provided label', () => {
      const Image = require('react-native').Image;
      const { UNSAFE_getByType } = render(
        <Doodle variant="family" accessibilityLabel="Peggy and her family" />,
      );
      const img = UNSAFE_getByType(Image);
      expect(img.props.accessible).toBe(true);
      expect(img.props.accessibilityElementsHidden).toBe(false);
      expect(img.props.importantForAccessibility).toBe('yes');
      expect(img.props.accessibilityRole).toBe('image');
      expect(img.props.accessibilityLabel).toBe('Peggy and her family');
    });
  });

  describe('hero-surface guard', () => {
    let warnSpy: jest.SpyInstance;
    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('dev-warns when rendered on a peggy-blue hero surface', () => {
      render(
        <SurfaceProvider surface="hero">
          <Doodle variant="mom" />
        </SurfaceProvider>,
      );
      expect(warnSpy).toHaveBeenCalled();
      const msg = String(warnSpy.mock.calls[0][0] ?? '');
      expect(msg).toMatch(/hero/i);
      expect(msg).toMatch(/Doodle/);
    });

    it('does not warn on white/card surface', () => {
      render(
        <SurfaceProvider surface="card">
          <Doodle variant="mom" />
        </SurfaceProvider>,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn on lavender surface', () => {
      render(
        <SurfaceProvider surface="lavender">
          <Doodle variant="family" />
        </SurfaceProvider>,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
