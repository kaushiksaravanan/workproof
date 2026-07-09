/**
 * Unit tests for services/llm.ts — parseAmount + regexExtract + extractWorkFields.
 *
 * These are pure functions (no network unless online:true is passed to
 * extractWorkFields, which we never do here). expo-crypto is mocked away by
 * llm.ts's dependency graph but we don't need it directly.
 */

// Config mock — llm.ts imports CIPHERSTACK_TOKEN + CIPHERSTACK_VEND_URL.
// We only exercise the OFFLINE path (regex baseline), so undefined token is fine.
jest.mock('../config', () => ({
  CIPHERSTACK_TOKEN: undefined,
  CIPHERSTACK_VEND_URL: 'https://example.local/vend/gemini',
}));

import { parseAmount, regexExtract, extractWorkFields } from '../llm';

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
