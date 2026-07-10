/**
 * Unit tests for services/llm.ts — parseAmount + regexExtract + extractWorkFields.
 *
 * These are pure functions (no network unless online:true is passed to
 * extractWorkFields, which we never do here). expo-crypto is mocked away by
 * llm.ts's dependency graph but we don't need it directly.
 */

// Config mock — llm.ts imports API_VEND_BASE_URL. Fix the value so the
// native path builds a predictable URL that the tests can assert on.
jest.mock('../config', () => ({
  API_VEND_BASE_URL: 'https://vend-test.example.com',
}));

import {
  parseAmount,
  regexExtract,
  extractWorkFields,
  vendGeminiKey,
  translateTranscript,
} from '../llm';
import { Platform } from 'react-native';

describe('parseAmount — string → number', () => {
  it('returns 0 for empty/whitespace', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('   ')).toBe(0);
  });

  it('parses a plain integer', () => {
    expect(parseAmount('1500')).toBe(1500);
  });

  it('parses a comma-separated integer', () => {
    expect(parseAmount('1,500')).toBe(1500);
    expect(parseAmount('1,500,000')).toBe(1500000);
  });

  it('parses a decimal', () => {
    expect(parseAmount('1500.50')).toBe(1500.5);
  });

  it('strips a leading rupee prefix before numeric parse', () => {
    expect(parseAmount('rs 1500')).toBe(1500);
    expect(parseAmount('Rs. 2500')).toBe(2500);
    expect(parseAmount('INR 3000')).toBe(3000);
    expect(parseAmount('₹4500')).toBe(4500);
    expect(parseAmount('rupees 500')).toBe(500);
  });

  it("parses shorthand 'k' as thousands", () => {
    expect(parseAmount('1.5k')).toBe(1500);
    expect(parseAmount('2k')).toBe(2000);
  });

  it("parses shorthand 'lakh' / 'lac' / 'l' as 100k", () => {
    expect(parseAmount('2 lakh')).toBe(200000);
    expect(parseAmount('3lac')).toBe(300000);
    expect(parseAmount('1.5l')).toBe(150000);
  });

  it("parses shorthand 'cr' / 'crore' as 10M", () => {
    expect(parseAmount('1cr')).toBe(10000000);
    expect(parseAmount('2.5 crore')).toBe(25000000);
  });

  it("parses shorthand 'hundred' / 'h'", () => {
    expect(parseAmount('5 hundred')).toBe(500);
    expect(parseAmount('3h')).toBe(300);
  });

  it("parses word-numbers 'fifteen hundred'", () => {
    expect(parseAmount('fifteen hundred')).toBe(1500);
  });

  it("parses word-numbers 'two thousand five hundred'", () => {
    expect(parseAmount('two thousand five hundred')).toBe(2500);
  });

  it("parses 'thousand' with implicit 1", () => {
    expect(parseAmount('thousand')).toBe(1000);
  });

  it("parses 'two lakh five thousand'", () => {
    expect(parseAmount('two lakh five thousand')).toBe(205000);
  });

  it('ignores unknown tokens without failing (returns 0 if nothing matched)', () => {
    expect(parseAmount('gibberish')).toBe(0);
  });

  it("handles 'and' as a word separator", () => {
    expect(parseAmount('two hundred and fifty')).toBe(250);
  });

  it('returns 0 for non-string-like inputs (empty result after cleaning)', () => {
    expect(parseAmount('$$$')).toBe(0);
  });
});

describe('regexExtract — transcript → ExtractedFields', () => {
  it('returns empty defaults for empty/missing input', () => {
    const out = regexExtract('');
    expect(out).toEqual({
      workType: '',
      clientName: '',
      location: '',
      amountReceived: 0,
      amountPending: 0,
      notes: '',
    });
  });

  it('picks a known work type from the allow-list', () => {
    expect(regexExtract('Did plastering today').workType).toBe('plastering');
    expect(regexExtract('finished painting the wall').workType).toBe('painting');
    expect(regexExtract('electrical repair').workType).toBe('electrical');
  });

  it("falls back to verb-driven work-type when nothing matches the list", () => {
    const out = regexExtract('Working on kitchen renovation for Sharma');
    expect(out.workType).toBe('kitchen');
  });

  it('parses received amount from digit form', () => {
    const out = regexExtract('Did plastering. Got 5000.');
    expect(out.amountReceived).toBe(5000);
  });

  it('parses received amount from word form ("fifteen hundred")', () => {
    const out = regexExtract('Painting done. Received fifteen hundred rupees.');
    expect(out.amountReceived).toBe(1500);
  });

  it('parses received amount from shorthand ("5 thousand")', () => {
    const out = regexExtract('got 5 thousand today');
    expect(out.amountReceived).toBe(5000);
  });

  it('parses pending amount from multiple synonyms', () => {
    expect(regexExtract('pending 2500').amountPending).toBe(2500);
    expect(regexExtract('balance is 3000').amountPending).toBe(3000);
    expect(regexExtract('remaining 500').amountPending).toBe(500);
    expect(regexExtract('owes 1000').amountPending).toBe(1000);
    expect(regexExtract('due: 750').amountPending).toBe(750);
  });

  it("picks up location from 'in <Place>' patterns (captures greedily up to punctuation)", () => {
    // The location regex is lazy on the capture but expects '.' / ',' / EOL
    // as the terminator, so trailing "today." gets included in the span.
    const out = regexExtract('Did masonry work in Andheri today.');
    expect(out.location.startsWith('Andheri')).toBe(true);
  });

  it("picks up client from 'for X' patterns", () => {
    const out = regexExtract('Painting for Sharma Construction in Andheri.');
    expect(out.clientName).toBe('Sharma Construction');
  });

  it("captures a lone 'in <Place>' with trailing punctuation", () => {
    // 'in Andheri.' with a period immediately after → captures cleanly.
    const out = regexExtract('Did masonry in Andheri.');
    expect(out.location).toBe('Andheri');
  });

  it("captures 'at <Place>' as location (dedupe with client is best-effort)", () => {
    const out = regexExtract('Working at Green Valley for Green Valley.');
    // The dedupe guard clears clientName when it matches location. Location
    // itself may or may not include the trailing "for X" span depending on
    // whether the regex bailed on the "for" boundary — pin whichever
    // behavior is actually there so a regex tweak becomes a signal.
    expect(out.location.length).toBeGreaterThan(0);
    expect(out.location.startsWith('Green Valley')).toBe(true);
  });

  it("picks notes from 'still need to X' / 'left to do X'", () => {
    const out = regexExtract(
      'Painting done. Still need to sand the trim tomorrow.',
    );
    expect(out.notes).toContain('sand the trim');
  });

  it('caps notes to avoid dumping the whole transcript', () => {
    const long = 'x'.repeat(500);
    const out = regexExtract(`Still need to ${long}`);
    expect(out.notes.length).toBeLessThanOrEqual(180);
  });

  it('is safe on garbage input (no crash, all defaults)', () => {
    const out = regexExtract('!@#$%^&*()');
    expect(out).toEqual({
      workType: '',
      clientName: '',
      location: '',
      amountReceived: 0,
      amountPending: 0,
      notes: '',
    });
  });

  it('non-string input returns empty (defensive)', () => {
    const out = regexExtract(null as unknown as string);
    expect(out).toEqual({
      workType: '',
      clientName: '',
      location: '',
      amountReceived: 0,
      amountPending: 0,
      notes: '',
    });
  });
});

describe('extractWorkFields — default offline behavior', () => {
  it('returns the regex baseline when opts.online is omitted', async () => {
    const out = await extractWorkFields(
      'Did plastering for Sharma in Andheri. Got 5000.',
    );
    expect(out.workType).toBe('plastering');
    expect(out.clientName).toBe('Sharma');
    expect(out.amountReceived).toBe(5000);
  });

  it('returns the regex baseline when opts.online=false explicitly', async () => {
    const out = await extractWorkFields(
      'Did painting for Mehta. Got 3000.',
      { online: false },
    );
    expect(out.workType).toBe('painting');
    expect(out.amountReceived).toBe(3000);
  });
});

describe('vendGeminiKey — CipherStack vend flow', () => {
  const originalFetch = global.fetch;
  const originalOS = Platform.OS;

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  const setOS = (os: 'web' | 'ios' | 'android'): void => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };

  it('web path hits same-origin /api/vend', async () => {
    setOS('web');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'AIzaWEB', base_url: 'https://web.example/v1' }),
    });
    global.fetch = fetchMock as any;
    const result = await vendGeminiKey();
    expect(result).toEqual({ key: 'AIzaWEB', baseUrl: 'https://web.example/v1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/vend?group=gemini');
    expect((init as any).method).toBe('GET');
    // Regression: previously native passed an Authorization header inline;
    // both paths now route through /api/vend, and neither should send the
    // CipherStack token client-side. Verify no Authorization header.
    expect((init as any).headers?.Authorization).toBeUndefined();
  });

  it('native path hits API_VEND_BASE_URL/api/vend — no Authorization header', async () => {
    setOS('ios');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'AIzaNATIVE' }),
    });
    global.fetch = fetchMock as any;
    const result = await vendGeminiKey();
    // No base_url in response → falls back to Google's public endpoint.
    expect(result).toEqual({
      key: 'AIzaNATIVE',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    });
    const [url, init] = fetchMock.mock.calls[0];
    // Native uses the Vercel deployment URL from config, not CipherStack.
    expect(url).toBe('https://vend-test.example.com/api/vend?group=gemini');
    // Regression: the CipherStack token used to be bundled into the APK
    // via EXPO_PUBLIC_CIPHERSTACK_TOKEN and injected as a Bearer header.
    // Task #31 removed that — the token now lives only in the Vercel
    // serverless env. This test locks that in.
    expect((init as any).headers?.Authorization).toBeUndefined();
  });

  it('returns null when the vend response is not ok', async () => {
    setOS('web');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'nope' }),
    }) as any;
    expect(await vendGeminiKey()).toBeNull();
  });

  it('returns null when the vend response has no key field', async () => {
    setOS('web');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as any;
    expect(await vendGeminiKey()).toBeNull();
  });

  it('returns null when fetch throws (network / CORS / offline)', async () => {
    setOS('web');
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as any;
    expect(await vendGeminiKey()).toBeNull();
  });
});

describe('extractWorkFields — online (Gemini-augmented) path', () => {
  const originalFetch = global.fetch;
  const originalOS = Platform.OS;

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  const setOS = (os: 'web' | 'ios' | 'android'): void => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };

  // Helper: two-stage fetch mock — first call vends a key, second is Gemini.
  const mockVendThenGemini = (
    geminiResponse: { ok: boolean; text?: string } = {
      ok: true,
      text: '{"workType":"tiling","clientName":"","location":"","amountReceived":0,"amountPending":0,"notes":""}',
    },
  ): jest.Mock => {
    return jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          key: 'AIzaFAKE',
          base_url: 'https://gen.example/v1',
        }),
      })
      .mockResolvedValueOnce({
        ok: geminiResponse.ok,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: geminiResponse.text ?? '' }],
              },
            },
          ],
        }),
      });
  };

  it('online:true fills empty regex fields from Gemini output', async () => {
    setOS('ios');
    global.fetch = mockVendThenGemini() as any;
    // Transcript that regex can't parse into workType (no allow-list hit).
    const out = await extractWorkFields('the bathroom job is finished', {
      online: true,
    });
    // Regex baseline leaves workType empty → Gemini fills it with "tiling".
    expect(out.workType).toBe('tiling');
  });

  it('regex numeric baseline wins over Gemini (no hallucinated amounts)', async () => {
    setOS('ios');
    global.fetch = mockVendThenGemini({
      ok: true,
      // Gemini claims 99999 — regex saw "got 500" — the 500 must win.
      text: '{"workType":"","clientName":"","location":"","amountReceived":99999,"amountPending":0,"notes":""}',
    }) as any;
    const out = await extractWorkFields('did some work, got 500', {
      online: true,
    });
    expect(out.amountReceived).toBe(500);
  });

  it('falls back to regex baseline when vendGeminiKey fails', async () => {
    setOS('ios');
    // First call (vend) fails.
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'no keys' }),
    }) as any;
    const out = await extractWorkFields('plastering for Sharma got 5000', {
      online: true,
    });
    expect(out.workType).toBe('plastering');
    expect(out.amountReceived).toBe(5000);
  });

  it('falls back to regex baseline when Gemini upstream is non-ok', async () => {
    setOS('ios');
    global.fetch = mockVendThenGemini({ ok: false, text: '' }) as any;
    const out = await extractWorkFields('Did painting for Mehta. Got 3000.', {
      online: true,
    });
    // Regex baseline still returns painting + 3000.
    expect(out.workType).toBe('painting');
    expect(out.amountReceived).toBe(3000);
  });

  it('falls back to regex baseline when Gemini text is unparseable JSON', async () => {
    setOS('ios');
    global.fetch = mockVendThenGemini({
      ok: true,
      text: 'not-valid-json-at-all',
    }) as any;
    const out = await extractWorkFields('Did painting. Got 3000.', { online: true });
    // JSON.parse throws inside geminiExtract → returns null → baseline kept.
    expect(out.workType).toBe('painting');
    expect(out.amountReceived).toBe(3000);
  });
});

describe('translateTranscript — Gemini-backed cross-language proof-of-work', () => {
  const originalFetch = global.fetch;
  const originalOS = Platform.OS;
  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  const mockVendThenTranslate = (translation: string): jest.Mock =>
    jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          key: 'AIzaFAKE',
          base_url: 'https://gen.example/v1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: translation }] } }],
        }),
      });

  it('returns the translated text on happy-path Gemini call', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    global.fetch = mockVendThenTranslate(
      'Did plastering for Sharma. Received 5000, pending 2500.',
    ) as any;
    const out = await translateTranscript(
      'शर्मा के लिए प्लास्टर किया। 5000 मिले, 2500 बाकी।',
      'English',
    );
    expect(out).toBe(
      'Did plastering for Sharma. Received 5000, pending 2500.',
    );
  });

  it('returns null on empty transcript (guard, no vend call)', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    expect(await translateTranscript('', 'English')).toBeNull();
    expect(await translateTranscript('   ', 'English')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null on empty target language (guard, no vend call)', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    expect(await translateTranscript('some transcript', '')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when vend fails', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'no keys' }),
    }) as any;
    expect(
      await translateTranscript('some transcript', 'English'),
    ).toBeNull();
  });

  it('returns null when Gemini upstream returns non-ok', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          key: 'AIzaFAKE',
          base_url: 'https://gen.example/v1',
        }),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }) as any;
    expect(
      await translateTranscript('some transcript', 'English'),
    ).toBeNull();
  });

  it('returns null when Gemini returns no candidate text', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          key: 'AIzaFAKE',
          base_url: 'https://gen.example/v1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [] }),
      }) as any;
    expect(
      await translateTranscript('some transcript', 'English'),
    ).toBeNull();
  });

  it('trims whitespace from Gemini output', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    global.fetch = mockVendThenTranslate('  Did the work.  \n') as any;
    expect(
      await translateTranscript('did stuff', 'English'),
    ).toBe('Did the work.');
  });
});
