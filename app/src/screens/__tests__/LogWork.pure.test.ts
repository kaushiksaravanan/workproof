/**
 * Pure-function unit tests for LogWork's isDirtyOf() drag-to-dismiss
 * predicate. Skips the heavy expo-camera / expo-av mocks needed by the
 * screen-level LogWork.test.tsx.
 *
 * We still need lightweight stubs for the native modules LogWork imports at
 * the top of the file, because just requiring '../LogWork' pulls them in.
 */

jest.mock('expo-av', () => ({
  Audio: {
    Recording: class {},
    Sound: class {},
    setAudioModeAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));

jest.mock('expo-camera', () => {
  const RN = require('react-native');
  const R = require('react');
  const CameraView = R.forwardRef((props: any, _ref: any) =>
    R.createElement(RN.View, props),
  );
  return {
    CameraView,
    useCameraPermissions: () => [null, jest.fn()],
  };
});

jest.mock('../../services/media', () => ({
  ensureCopy: jest.fn(),
  readBytes: jest.fn(),
}));

jest.mock('../../services/llm', () => ({
  extractWorkFields: jest.fn(),
}));

jest.mock('../../services/hashing', () => ({
  hashRecord: jest.fn(),
}));

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
jest.mock('react-native-get-random-values', () => ({}));

import { isDirtyOf, parseAmountOrZero } from '../LogWork';

const empty = {
  workType: '',
  clientName: '',
  location: '',
  notes: '',
};

describe('isDirtyOf — drag-to-dismiss predicate', () => {
  it('reports NOT dirty for a fully-empty sheet', () => {
    expect(isDirtyOf(empty, '', '', '', null, null)).toBe(false);
  });

  it('reports NOT dirty for a whitespace-only workType', () => {
    expect(isDirtyOf({ ...empty, workType: '   ' }, '', '', '', null, null)).toBe(false);
  });

  it("is dirty when workType has content", () => {
    expect(
      isDirtyOf({ ...empty, workType: 'plastering' }, '', '', '', null, null),
    ).toBe(true);
  });

  it("is dirty when clientName has content", () => {
    expect(
      isDirtyOf({ ...empty, clientName: 'Sharma' }, '', '', '', null, null),
    ).toBe(true);
  });

  it("is dirty when location has content", () => {
    expect(
      isDirtyOf({ ...empty, location: 'Andheri' }, '', '', '', null, null),
    ).toBe(true);
  });

  it("is dirty when notes has content", () => {
    expect(
      isDirtyOf({ ...empty, notes: 'finish tmrw' }, '', '', '', null, null),
    ).toBe(true);
  });

  it("is dirty when amountReceivedRaw is non-empty", () => {
    expect(isDirtyOf(empty, '5000', '', '', null, null)).toBe(true);
  });

  it("is dirty when amountPendingRaw is non-empty", () => {
    expect(isDirtyOf(empty, '', '2500', '', null, null)).toBe(true);
  });

  it("is dirty when transcript has content", () => {
    expect(isDirtyOf(empty, '', '', 'did the wall', null, null)).toBe(true);
  });

  it("is dirty when audioUri is non-null", () => {
    expect(isDirtyOf(empty, '', '', '', 'file:///a.m4a', null)).toBe(true);
  });

  it("is dirty when photoUri is non-null", () => {
    expect(isDirtyOf(empty, '', '', '', null, 'file:///p.jpg')).toBe(true);
  });

  it("tolerates missing optional fields (clientName/location/notes undefined via ??)", () => {
    const partial = {
      workType: '',
      clientName: undefined as unknown as string,
      location: undefined as unknown as string,
      notes: undefined as unknown as string,
    };
    expect(isDirtyOf(partial, '', '', '', null, null)).toBe(false);
  });

  it("whitespace-only amount strings do not count as dirty", () => {
    expect(isDirtyOf(empty, '   ', '   ', '', null, null)).toBe(false);
  });

  it("whitespace-only transcript does not count as dirty", () => {
    expect(isDirtyOf(empty, '', '', '   ', null, null)).toBe(false);
  });

  it("empty string photoUri (not null) still counts as dirty (URI slot occupied)", () => {
    // Design intent: photoUri === null means "unset"; any string (even '')
    // means the user progressed past the capture step at least once. Cross
    // this branch with an explicit '' to lock the semantics.
    expect(isDirtyOf(empty, '', '', '', null, '')).toBe(true);
  });
});

describe('parseAmountOrZero — amount input coercion', () => {
  it('returns 0 for empty string', () => {
    expect(parseAmountOrZero('')).toBe(0);
  });

  it('returns 0 for pure whitespace', () => {
    expect(parseAmountOrZero('   ')).toBe(0);
  });

  it('parses a plain integer', () => {
    expect(parseAmountOrZero('5000')).toBe(5000);
  });

  it('parses a decimal', () => {
    expect(parseAmountOrZero('1234.56')).toBe(1234.56);
  });

  it('parses a leading-zero decimal', () => {
    expect(parseAmountOrZero('0.5')).toBe(0.5);
  });

  it('parses a partial-numeric prefix (parseFloat semantics: "5k" → 5)', () => {
    expect(parseAmountOrZero('5k')).toBe(5);
  });

  it('returns 0 for a non-numeric string', () => {
    expect(parseAmountOrZero('abc')).toBe(0);
  });

  it('returns 0 for "Infinity" (Number.isFinite guard)', () => {
    expect(parseAmountOrZero('Infinity')).toBe(0);
  });

  it('returns 0 for "-Infinity"', () => {
    expect(parseAmountOrZero('-Infinity')).toBe(0);
  });

  it('returns 0 for "NaN" literal', () => {
    expect(parseAmountOrZero('NaN')).toBe(0);
  });

  it('handles negative numbers (parseFloat allows leading minus)', () => {
    expect(parseAmountOrZero('-500')).toBe(-500);
  });

  it('handles scientific notation', () => {
    expect(parseAmountOrZero('1e3')).toBe(1000);
  });

  it('trims leading whitespace naturally via parseFloat', () => {
    expect(parseAmountOrZero('   500')).toBe(500);
  });
});
