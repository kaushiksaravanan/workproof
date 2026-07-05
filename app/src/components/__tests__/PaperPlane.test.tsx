import React from 'react';
import { render } from '@testing-library/react-native';
import Svg from 'react-native-svg';

import { PaperPlane } from '../PaperPlane';

function getStyle(svgProps: { style?: unknown }): {
  transform?: Array<{ rotate?: string }>;
  opacity?: number;
} {
  const style = svgProps.style as
    | { transform?: Array<{ rotate?: string }>; opacity?: number }
    | undefined;
  return style ?? {};
}

describe('PaperPlane — clamping (peggy-component-spec.md §Illustration)', () => {
  describe('size: 12–32dp accent band', () => {
    it('clamps size below 12 up to 12', () => {
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const { UNSAFE_getByType } = render(<PaperPlane size={4} />);
      const svg = UNSAFE_getByType(Svg);
      expect(svg.props.width).toBe(12);
      expect(svg.props.height).toBe(12);
      warnSpy.mockRestore();
    });

    it('clamps size above 32 down to 32', () => {
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const { UNSAFE_getByType } = render(<PaperPlane size={64} />);
      const svg = UNSAFE_getByType(Svg);
      expect(svg.props.width).toBe(32);
      expect(svg.props.height).toBe(32);
      warnSpy.mockRestore();
    });

    it('preserves in-range sizes', () => {
      const { UNSAFE_getByType } = render(<PaperPlane size={20} />);
      const svg = UNSAFE_getByType(Svg);
      expect(svg.props.width).toBe(20);
      expect(svg.props.height).toBe(20);
    });
  });

  describe('rotation: -25..+25° band', () => {
    it('clamps rotation below -25 up to -25', () => {
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const { UNSAFE_getByType } = render(<PaperPlane rotation={-90} />);
      const svg = UNSAFE_getByType(Svg);
      const style = getStyle(svg.props);
      expect(style.transform?.[0]?.rotate).toBe('-25deg');
      warnSpy.mockRestore();
    });

    it('clamps rotation above +25 down to +25', () => {
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const { UNSAFE_getByType } = render(<PaperPlane rotation={90} />);
      const svg = UNSAFE_getByType(Svg);
      const style = getStyle(svg.props);
      expect(style.transform?.[0]?.rotate).toBe('25deg');
      warnSpy.mockRestore();
    });

    it('preserves in-range rotations', () => {
      const { UNSAFE_getByType } = render(<PaperPlane rotation={15} />);
      const svg = UNSAFE_getByType(Svg);
      const style = getStyle(svg.props);
      expect(style.transform?.[0]?.rotate).toBe('15deg');
    });

    it('allows out-of-range rotation when unclamped is true', () => {
      const { UNSAFE_getByType } = render(
        <PaperPlane rotation={90} unclamped />,
      );
      const svg = UNSAFE_getByType(Svg);
      const style = getStyle(svg.props);
      expect(style.transform?.[0]?.rotate).toBe('90deg');
    });
  });

  describe('opacity: 0.6–0.9 band', () => {
    it('clamps opacity below 0.6 up to 0.6', () => {
      const { UNSAFE_getByType } = render(<PaperPlane opacity={0.1} />);
      const svg = UNSAFE_getByType(Svg);
      const style = getStyle(svg.props);
      expect(style.opacity).toBe(0.6);
    });

    it('clamps opacity above 0.9 down to 0.9', () => {
      const { UNSAFE_getByType } = render(<PaperPlane opacity={1} />);
      const svg = UNSAFE_getByType(Svg);
      const style = getStyle(svg.props);
      expect(style.opacity).toBe(0.9);
    });

    it('preserves in-range opacity', () => {
      const { UNSAFE_getByType } = render(<PaperPlane opacity={0.75} />);
      const svg = UNSAFE_getByType(Svg);
      const style = getStyle(svg.props);
      expect(style.opacity).toBe(0.75);
    });

    it('defaults to max opacity (0.9) when omitted', () => {
      const { UNSAFE_getByType } = render(<PaperPlane />);
      const svg = UNSAFE_getByType(Svg);
      const style = getStyle(svg.props);
      expect(style.opacity).toBe(0.9);
    });
  });

  describe('dev warnings', () => {
    let warnSpy: jest.SpyInstance;
    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('warns when size is out of the 12–32dp band', () => {
      render(<PaperPlane size={48} />);
      expect(warnSpy).toHaveBeenCalled();
      const msg = String(warnSpy.mock.calls[0][0] ?? '');
      expect(msg).toMatch(/PaperPlane/);
      expect(msg).toMatch(/size/);
    });

    it('warns when rotation is outside -25..+25° and not unclamped', () => {
      render(<PaperPlane rotation={45} />);
      expect(warnSpy).toHaveBeenCalled();
      const msg = String(warnSpy.mock.calls[0][0] ?? '');
      expect(msg).toMatch(/PaperPlane/);
      expect(msg).toMatch(/rotation/);
    });

    it('does not warn when rotation is out of range but unclamped is true', () => {
      render(<PaperPlane rotation={45} unclamped />);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn for in-range size and rotation', () => {
      render(<PaperPlane size={24} rotation={10} />);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
