/**
 * Unit tests for the useAppFonts hook.
 *
 * The @expo-google-fonts/* useFonts hooks are mocked to expose their
 * loading state as a per-test controllable tuple. The hook we're testing
 * just AND-composes their `loaded` flags and prefers Plus Jakarta's error
 * over Fraunces's when both fail.
 */

// eslint-disable-next-line no-var
var mockJakartaResult: [boolean, Error | null] = [false, null];
// eslint-disable-next-line no-var
var mockFrauncesResult: [boolean, Error | null] = [false, null];

jest.mock('@expo-google-fonts/plus-jakarta-sans', () => ({
  useFonts: () => mockJakartaResult,
  PlusJakartaSans_400Regular: 'mock-400',
  PlusJakartaSans_500Medium: 'mock-500',
  PlusJakartaSans_600SemiBold: 'mock-600',
  PlusJakartaSans_700Bold: 'mock-700',
  PlusJakartaSans_800ExtraBold: 'mock-800',
}));

jest.mock('@expo-google-fonts/fraunces', () => ({
  useFonts: () => mockFrauncesResult,
  Fraunces_500Medium_Italic: 'mock-fraunces-500i',
  Fraunces_700Bold_Italic: 'mock-fraunces-700i',
}));

import { renderHook } from '@testing-library/react-native';
import { useAppFonts } from '../fonts';

describe('useAppFonts', () => {
  it('reports NOT loaded while either font family is still loading', () => {
    mockJakartaResult = [false, null];
    mockFrauncesResult = [true, null];
    const { result: r1 } = renderHook(() => useAppFonts());
    expect(r1.current.loaded).toBe(false);
    expect(r1.current.error).toBeNull();

    mockJakartaResult = [true, null];
    mockFrauncesResult = [false, null];
    const { result: r2 } = renderHook(() => useAppFonts());
    expect(r2.current.loaded).toBe(false);
    expect(r2.current.error).toBeNull();
  });

  it('reports loaded=true only when BOTH families are loaded', () => {
    mockJakartaResult = [true, null];
    mockFrauncesResult = [true, null];
    const { result } = renderHook(() => useAppFonts());
    expect(result.current.loaded).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("surfaces Plus Jakarta's error verbatim when it fails", () => {
    const err = new Error('jakarta network fail');
    mockJakartaResult = [false, err];
    mockFrauncesResult = [true, null];
    const { result } = renderHook(() => useAppFonts());
    expect(result.current.loaded).toBe(false);
    expect(result.current.error).toBe(err);
  });

  it("surfaces Fraunces's error when Plus Jakarta is clean but Fraunces fails", () => {
    const err = new Error('fraunces 404');
    mockJakartaResult = [true, null];
    mockFrauncesResult = [false, err];
    const { result } = renderHook(() => useAppFonts());
    expect(result.current.loaded).toBe(false);
    expect(result.current.error).toBe(err);
  });

  it("prefers Jakarta's error when BOTH families fail (?? precedence)", () => {
    const jakartaErr = new Error('jakarta boom');
    const frauncesErr = new Error('fraunces boom');
    mockJakartaResult = [false, jakartaErr];
    mockFrauncesResult = [false, frauncesErr];
    const { result } = renderHook(() => useAppFonts());
    expect(result.current.error).toBe(jakartaErr);
  });

  it('returns error=null when neither family errors (both still loading)', () => {
    mockJakartaResult = [false, null];
    mockFrauncesResult = [false, null];
    const { result } = renderHook(() => useAppFonts());
    expect(result.current.error).toBeNull();
    expect(result.current.loaded).toBe(false);
  });
});
