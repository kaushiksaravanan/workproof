import { colors, spacing, radii, tapTargets, motion } from '../tokens';

describe('Peggy token contract', () => {
  describe('brand colors', () => {
    it('peggyBlue is #7DA1FF', () => {
      expect(colors.peggyBlue).toBe('#7DA1FF');
    });

    it('peggyLavender is #CAD9F6', () => {
      expect(colors.peggyLavender).toBe('#CAD9F6');
    });

    it('peggyInk is #001A33', () => {
      expect(colors.peggyInk).toBe('#001A33');
    });

    it('peggyYellow is #FFD84D', () => {
      expect(colors.peggyYellow).toBe('#FFD84D');
    });

    it('peggyCoral is #F0445B', () => {
      expect(colors.peggyCoral).toBe('#F0445B');
    });

    it('peggyMint is #C9EFC3', () => {
      expect(colors.peggyMint).toBe('#C9EFC3');
    });

    it('peggyAmber is #BD814B', () => {
      expect(colors.peggyAmber).toBe('#BD814B');
    });
  });

  describe('spacing follows 4dp grid', () => {
    it('xs is 4', () => {
      expect(spacing.xs).toBe(4);
    });

    it('sm is 8', () => {
      expect(spacing.sm).toBe(8);
    });

    it('md is 12', () => {
      expect(spacing.md).toBe(12);
    });

    it('base is 16', () => {
      expect(spacing.base).toBe(16);
    });

    it('lg is 20', () => {
      expect(spacing.lg).toBe(20);
    });

    it('xl is 24', () => {
      expect(spacing.xl).toBe(24);
    });

    it('xxl is 32', () => {
      expect(spacing.xxl).toBe(32);
    });

    it('every spacing value is a multiple of 4', () => {
      Object.values(spacing).forEach((value) => {
        expect(value % 4).toBe(0);
      });
    });
  });

  describe('radii', () => {
    it('sm is 12', () => {
      expect(radii.sm).toBe(12);
    });

    it('md is 20', () => {
      expect(radii.md).toBe(20);
    });

    it('lg is 28', () => {
      expect(radii.lg).toBe(28);
    });

    it('button is 14', () => {
      expect(radii.button).toBe(14);
    });

    it('pill is 9999', () => {
      expect(radii.pill).toBe(9999);
    });
  });

  describe('tapTargets', () => {
    it('min is 48 (Peggy + Apple HIG-compatible)', () => {
      expect(tapTargets.min).toBe(48);
    });
  });

  describe('motion', () => {
    it('hoverLiftMs is 150', () => {
      expect(motion.hoverLiftMs).toBe(150);
    });

    it('pressSettleMs is 80', () => {
      expect(motion.pressSettleMs).toBe(80);
    });
  });
});
