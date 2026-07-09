/**
 * Unit tests for services/proof.ts.
 *
 * buildProofHtml is pure — no mocking needed for the template branches.
 * generateProofPdf and shareProofPdf go through expo-print and expo-sharing,
 * which are mocked here.
 */

// eslint-disable-next-line no-var
var mockPrintFile = jest.fn(async ({ html: _h }: { html: string }) => ({
  uri: 'file:///tmp/proof-mock.pdf',
}));
// eslint-disable-next-line no-var
var mockShareAvailable = jest.fn(async () => true);
// eslint-disable-next-line no-var
var mockShareAsync = jest.fn(async (_uri: string, _opts?: unknown) => undefined);

jest.mock('expo-print', () => ({
  printToFileAsync: (opts: { html: string }) => mockPrintFile(opts),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockShareAvailable(),
  shareAsync: (uri: string, opts?: unknown) => mockShareAsync(uri, opts),
}));

import { buildProofHtml, generateProofPdf, shareProofPdf } from '../proof';
import type { WorkRecord } from '../../types';

const record = (over: Partial<WorkRecord> = {}): WorkRecord => ({
  id: 'abc123def456',
  createdAt: '2026-01-01T00:00:00.000Z',
  workType: 'plastering',
  clientName: 'Sharma Construction',
  location: 'Andheri',
  amountReceived: 5000,
  amountPending: 2500,
  workerName: 'Ravi Kumar',
  photoUri: 'file:///photo.jpg',
  transcript: 'did the wall',
  notes: 'finish tomorrow',
  hash: 'a'.repeat(64),
  ...over,
});

describe('buildProofHtml — escaping', () => {
  it('escapes < > & " \' in every text-injected field', () => {
    const html = buildProofHtml(
      record({
        workType: '<img src=x onerror=alert(1)>',
        clientName: '"Hacker & Co."',
        location: "O'Malley's",
        transcript: '<script>alert(1)</script>',
        notes: 'foo & <b>bar</b>',
        workerName: 'Alice <Boss>',
      }),
    );
    // None of the raw injections should appear.
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    // The escaped forms should.
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot;Hacker &amp; Co.&quot;');
    expect(html).toContain('O&#39;Malley&#39;s');
  });

  it("emits '—' for missing or empty required fields", () => {
    const html = buildProofHtml(
      record({
        workType: '',
        clientName: '',
        location: '',
        notes: '',
        transcript: '',
      }),
    );
    // Each row should render the em-dash fallback.
    expect(html).toContain('>—<');
  });
});

describe('buildProofHtml — photo URL scheme allow-list', () => {
  const cases: Array<[string, boolean]> = [
    ['file:///photo.jpg', true],
    ['content://media/photo.jpg', true],
    ['https://example.com/photo.jpg', true],
    ['http://example.com/photo.jpg', true],
    ['data:image/png;base64,iVBORw0KGgo=', true],
    // Hostile / non-image schemes must be dropped.
    ['javascript:alert(1)', false],
    ['data:text/html,<script>alert(1)</script>', false],
    ['vbscript:msgbox(1)', false],
    ['about:blank', false],
    ['ftp://example.com/photo.jpg', false],
  ];

  it.each(cases)('%s → allowed=%s', (uri, allowed) => {
    const html = buildProofHtml(record({ photoUri: uri }));
    if (allowed) {
      expect(html).toContain(`src="${uri.replace(/"/g, '&quot;')}"`);
      expect(html).toContain('Photo</div>');
    } else {
      expect(html).not.toContain(`src="${uri}"`);
      // Photo section should not render for a rejected URI.
      const photoSectionCount = (html.match(/section-title">Photo</g) || [])
        .length;
      expect(photoSectionCount).toBe(0);
    }
  });

  it('empty / undefined photoUri does NOT render the Photo section', () => {
    expect(buildProofHtml(record({ photoUri: '' as unknown as string })))
      .not.toMatch(/section-title">Photo</);
    // @ts-expect-error deliberate — testing the runtime fallback
    expect(buildProofHtml(record({ photoUri: undefined })))
      .not.toMatch(/section-title">Photo</);
  });
});

describe('buildProofHtml — worker name splitter', () => {
  it('splits first + last so the last name gets the yellow marker span', () => {
    const html = buildProofHtml(record({ workerName: 'Ravi Kumar' }));
    expect(html).toContain('Ravi <span class="last">Kumar</span>');
  });

  it('single-word name renders as first only (no last-span highlight)', () => {
    const html = buildProofHtml(record({ workerName: 'Ravi' }));
    expect(html).toContain('Ravi<span class="last"></span>');
  });

  it('multi-word name puts everything except the final token into first', () => {
    const html = buildProofHtml(record({ workerName: 'Priya S. Kumar' }));
    expect(html).toContain('Priya S. <span class="last">Kumar</span>');
  });

  it('empty workerName is safe (no crash, no first, no last)', () => {
    const html = buildProofHtml(record({ workerName: '' }));
    expect(html).toContain('<span class="last"></span>');
  });

  it('handles whitespace-only workerName as empty', () => {
    const html = buildProofHtml(record({ workerName: '   ' }));
    expect(html).toContain('<span class="last"></span>');
  });
});

describe('buildProofHtml — anchored vs unanchored footer', () => {
  it("unanchored: renders the 'locally signed / anchor in the app' pitch", () => {
    const html = buildProofHtml(record({ anchorTxHash: undefined }));
    expect(html).toContain('locally signed');
    expect(html).not.toContain('amoy.polygonscan.com/tx/');
  });

  it('anchored: renders the Polygonscan URL as the verification link', () => {
    const html = buildProofHtml(
      record({ anchorTxHash: '0xdead', anchorChainId: 80002 }),
    );
    expect(html).toContain('amoy.polygonscan.com/tx/0xdead');
    expect(html).toContain('Anchored on-chain');
  });

  it("queued: prefix does NOT count as anchored (uses the local-signed copy)", () => {
    const html = buildProofHtml(
      record({ anchorTxHash: 'queued:xyz', anchorChainId: 80002 }),
    );
    expect(html).toContain('locally signed');
    expect(html).not.toContain('amoy.polygonscan.com');
  });
});

describe('buildProofHtml — amounts + date', () => {
  it('formats amount 0 as "0"', () => {
    const html = buildProofHtml(record({ amountReceived: 0, amountPending: 0 }));
    expect(html).toContain('>0<');
  });

  it('formats large numbers with locale separators', () => {
    const html = buildProofHtml(record({ amountReceived: 1234567 }));
    // We can't be 100% sure of the locale delimiter (locale-dependent), but
    // the raw digit string 1234567 must NOT appear unbroken.
    expect(html).not.toContain('>1234567<');
  });

  it('unparseable createdAt renders the raw string unchanged', () => {
    const html = buildProofHtml(record({ createdAt: 'not-a-date' }));
    expect(html).toContain('Issued not-a-date');
  });
});

describe('generateProofPdf', () => {
  beforeEach(() => {
    mockPrintFile.mockClear();
  });

  it('calls Print.printToFileAsync with the generated HTML', async () => {
    await generateProofPdf(record());
    expect(mockPrintFile).toHaveBeenCalledTimes(1);
    const [{ html }] = mockPrintFile.mock.calls[0];
    expect(html).toContain('WorkProof');
    expect(html).toContain(record().workType);
  });

  it('returns { record, pdfUri, generatedAt }', async () => {
    const rec = record();
    const doc = await generateProofPdf(rec);
    expect(doc.record).toBe(rec);
    expect(doc.pdfUri).toBe('file:///tmp/proof-mock.pdf');
    expect(new Date(doc.generatedAt).toString()).not.toBe('Invalid Date');
  });
});

describe('shareProofPdf', () => {
  beforeEach(() => {
    mockShareAsync.mockClear();
    mockShareAvailable.mockClear();
    mockShareAvailable.mockResolvedValue(true);
  });

  it("no-ops when Sharing.isAvailableAsync returns false", async () => {
    mockShareAvailable.mockResolvedValueOnce(false);
    await shareProofPdf('file:///proof.pdf');
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('calls Sharing.shareAsync with PDF mime + a dialog title when available', async () => {
    await shareProofPdf('file:///proof.pdf');
    expect(mockShareAsync).toHaveBeenCalledWith('file:///proof.pdf', {
      mimeType: 'application/pdf',
      dialogTitle: 'Share proof',
    });
  });
});
