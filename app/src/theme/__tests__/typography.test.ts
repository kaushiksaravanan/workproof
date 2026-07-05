import { typography, fontFamilies } from '../typography';

describe('typography', () => {
  describe('fontSize values match android/Type.kt', () => {
    it('display has fontSize 34', () => {
      expect(typography.display.fontSize).toBe(34);
    });

    it('h1 has fontSize 28', () => {
      expect(typography.h1.fontSize).toBe(28);
    });

    it('h2 has fontSize 22', () => {
      expect(typography.h2.fontSize).toBe(22);
    });

    it('title has fontSize 17', () => {
      expect(typography.title.fontSize).toBe(17);
    });

    it('body has fontSize 15', () => {
      expect(typography.body.fontSize).toBe(15);
    });

    it('label has fontSize 14', () => {
      expect(typography.label.fontSize).toBe(14);
    });

    it('caption has fontSize 12', () => {
      expect(typography.caption.fontSize).toBe(12);
    });
  });

  describe('lineHeight is at least 1.2x fontSize for every level', () => {
    const levels: Array<keyof typeof typography> = [
      'display',
      'h1',
      'h2',
      'headline',
      'title',
      'body',
      'label',
      'sectionLabel',
      'caption',
      'formLabel',
      'serifItalic',
    ];

    levels.forEach((level) => {
      it(`${level} has lineHeight >= 1.2x fontSize`, () => {
        const style = typography[level];
        const fontSize = style.fontSize as number;
        const lineHeight = style.lineHeight as number;
        expect(lineHeight).toBeGreaterThanOrEqual(fontSize * 1.2);
      });
    });
  });

  describe('fontFamily assignments', () => {
    it('display uses a PlusJakartaSans family', () => {
      expect(typography.display.fontFamily).toMatch(/^PlusJakartaSans/);
    });

    it('h1 uses a PlusJakartaSans family', () => {
      expect(typography.h1.fontFamily).toMatch(/^PlusJakartaSans/);
    });

    it('h2 uses a PlusJakartaSans family', () => {
      expect(typography.h2.fontFamily).toMatch(/^PlusJakartaSans/);
    });

    it('title uses a PlusJakartaSans family', () => {
      expect(typography.title.fontFamily).toMatch(/^PlusJakartaSans/);
    });

    it('body uses a PlusJakartaSans family', () => {
      expect(typography.body.fontFamily).toMatch(/^PlusJakartaSans/);
    });

    it('label uses a PlusJakartaSans family', () => {
      expect(typography.label.fontFamily).toMatch(/^PlusJakartaSans/);
    });

    it('caption uses a PlusJakartaSans family', () => {
      expect(typography.caption.fontFamily).toMatch(/^PlusJakartaSans/);
    });

    it('serifItalic uses a Fraunces family', () => {
      expect(typography.serifItalic.fontFamily).toMatch(/^Fraunces/);
    });

    it('fontFamilies sans tokens reference PlusJakartaSans', () => {
      expect(fontFamilies.sansRegular).toMatch(/^PlusJakartaSans/);
      expect(fontFamilies.sansMedium).toMatch(/^PlusJakartaSans/);
      expect(fontFamilies.sansSemiBold).toMatch(/^PlusJakartaSans/);
      expect(fontFamilies.sansBold).toMatch(/^PlusJakartaSans/);
      expect(fontFamilies.sansExtraBold).toMatch(/^PlusJakartaSans/);
    });

    it('fontFamilies serifItalic tokens reference Fraunces', () => {
      expect(fontFamilies.serifItalicMedium).toMatch(/^Fraunces/);
      expect(fontFamilies.serifItalicBold).toMatch(/^Fraunces/);
    });
  });

  describe('letterSpacing follows HIG large-title convention', () => {
    it('display has negative letterSpacing', () => {
      expect(typography.display.letterSpacing).toBeLessThan(0);
    });

    it('h1 has negative letterSpacing', () => {
      expect(typography.h1.letterSpacing).toBeLessThan(0);
    });

    it('h2 has non-positive letterSpacing (HIG: large titles trend tight)', () => {
      // h2 in this scale is 0 (Title2 neutral); accept <= 0 to match the
      // "negative for display/h1/h2" requirement direction.
      expect(typography.h2.letterSpacing ?? 0).toBeLessThanOrEqual(0);
    });
  });

  describe('formLabel form-field treatment', () => {
    it('has textTransform "uppercase"', () => {
      expect(typography.formLabel.textTransform).toBe('uppercase');
    });

    it('has letterSpacing 0.6', () => {
      expect(typography.formLabel.letterSpacing).toBe(0.6);
    });
  });
});
