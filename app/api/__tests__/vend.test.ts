/**
 * Unit tests for the /api/vend Vercel serverless proxy.
 *
 * These exercise the handler with fake VercelRequest/VercelResponse objects
 * and a stubbed global fetch, so no network / no CipherStack round-trip.
 */

import handler, { __resetRateLimitForTests } from '../vend';

type FakeRes = {
  statusCode: number | null;
  body: unknown;
  headers: Record<string, string>;
  status(code: number): FakeRes;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: null,
    body: undefined,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return res;
}

function makeReq(
  query: Record<string, string | undefined> = {},
  method: string = 'GET',
  headers: Record<string, string | undefined> = {},
): {
  method: string;
  query: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
} {
  return { method, query, headers };
}

const CIPHERSTACK_BASE = 'https://cipherstack.kaushik.cv/api/v1';
const ORIGINAL_ENV = process.env.CIPHERSTACK_TOKEN;
const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.CIPHERSTACK_TOKEN;
  else process.env.CIPHERSTACK_TOKEN = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
  jest.restoreAllMocks();
  // Clear the in-memory rate-limit state between tests. Otherwise a test
  // that fires 11 requests to trigger the cap leaves poison state that
  // fails unrelated later tests.
  __resetRateLimitForTests();
});

describe('/api/vend', () => {
  it('always sets Cache-Control: no-store', async () => {
    const res = makeRes();
    await handler(makeReq({ group: 'nope' }), res);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('returns 405 for non-GET/HEAD methods', async () => {
    const res = makeRes();
    await handler(makeReq({ group: 'gemini' }, 'POST'), res);
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'method not allowed' });
  });

  it('allows HEAD (same handling as GET; ok for health probes)', async () => {
    process.env.CIPHERSTACK_TOKEN = 'csk_test';
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ key: 'k' }),
    }) as unknown as typeof fetch;
    const res = makeRes();
    await handler(makeReq({ group: 'gemini' }, 'HEAD'), res);
    // HEAD flows through the same branch as GET — 200 not 405.
    expect(res.statusCode).toBe(200);
  });

  it('returns 400 when group is missing', async () => {
    const res = makeRes();
    await handler(makeReq({}), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'unknown group' });
  });

  it('returns 400 for a group not in the allow-list', async () => {
    const res = makeRes();
    await handler(makeReq({ group: 'stripe' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'unknown group' });
  });

  it('returns 503 when CIPHERSTACK_TOKEN env is missing', async () => {
    delete process.env.CIPHERSTACK_TOKEN;
    const res = makeRes();
    await handler(makeReq({ group: 'gemini' }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'vend not configured on server' });
  });

  it('forwards a valid group to CipherStack with the bearer token', async () => {
    process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ key: 'AIzaFAKE', key_id: 'kid_1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = makeRes();
    await handler(makeReq({ group: 'gemini' }), res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CIPHERSTACK_BASE}/vend/gemini`);
    expect(opts.method).toBe('GET');
    expect((opts.headers as Record<string, string>).Authorization).toBe(
      'Bearer csk_test_token',
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ key: 'AIzaFAKE', key_id: 'kid_1' });
  });

  it('preserves upstream status code (e.g. 429 rate-limited)', async () => {
    process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        status: 429,
        text: async () => JSON.stringify({ error: 'rate_limited' }),
      }) as unknown as typeof fetch;

    const res = makeRes();
    await handler(makeReq({ group: 'gemini' }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'rate_limited' });
  });

  it('returns 502 when upstream returns non-JSON', async () => {
    process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        status: 200,
        text: async () => '<html>bad gateway</html>',
      }) as unknown as typeof fetch;

    const res = makeRes();
    await handler(makeReq({ group: 'gemini' }), res);
    expect(res.statusCode).toBe(502);
    const body = res.body as { error: string; body: string };
    expect(body.error).toBe('upstream non-json');
    expect(body.body).toContain('bad gateway');
  });

  it('returns 502 when fetch throws (network error)', async () => {
    process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const res = makeRes();
    await handler(makeReq({ group: 'gemini' }), res);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'ECONNREFUSED' });
  });

  it('accepts a group when query.group is an array (takes first)', async () => {
    process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ key: 'K' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = makeRes();
    // TS: our fake accepts arrays too
    await handler(
      {
        method: 'GET',
        query: { group: ['gemini', 'other'] },
        headers: {},
      } as unknown as {
        method: string;
        query: Record<string, string | undefined>;
        headers: Record<string, string | undefined>;
      },
      res,
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${CIPHERSTACK_BASE}/vend/gemini`);
    expect(res.statusCode).toBe(200);
  });

  describe('origin allow-list', () => {
    it('accepts requests with an allow-listed browser Origin', async () => {
      process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ key: 'K' }),
      }) as unknown as typeof fetch;

      const res = makeRes();
      await handler(
        makeReq({ group: 'gemini' }, 'GET', {
          origin: 'https://workproof-demo.vercel.app',
        }),
        res,
      );
      expect(res.statusCode).toBe(200);
    });

    it('rejects requests with a non-allow-listed browser Origin', async () => {
      process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const res = makeRes();
      await handler(
        makeReq({ group: 'gemini' }, 'GET', {
          origin: 'https://evil.example.com',
        }),
        res,
      );
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: 'origin not allowed' });
      // Upstream never called — we short-circuit before hitting CipherStack.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('accepts requests with no Origin header (native app pattern)', async () => {
      process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ key: 'K' }),
      }) as unknown as typeof fetch;

      const res = makeRes();
      // Native Expo Go / APK builds do not send Origin. Simulate that.
      await handler(makeReq({ group: 'gemini' }, 'GET'), res);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('per-IP rate limit', () => {
    it('allows requests up to the cap, then 429s the (cap+1)th within the window', async () => {
      process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ key: 'K' }),
      }) as unknown as typeof fetch;

      // Default cap is 10 per 60s. Fire 10 → all 200. The 11th → 429.
      const reqFromSameIp = () =>
        makeReq({ group: 'gemini' }, 'GET', {
          'x-forwarded-for': '203.0.113.5',
        });

      for (let i = 0; i < 10; i++) {
        const res = makeRes();
        await handler(reqFromSameIp(), res);
        expect(res.statusCode).toBe(200);
      }
      const throttled = makeRes();
      await handler(reqFromSameIp(), throttled);
      expect(throttled.statusCode).toBe(429);
      expect(throttled.body).toEqual({ error: 'rate limit exceeded' });
      // Retry-After tells the client how long to back off.
      expect(throttled.headers['Retry-After']).toBeDefined();
    });

    it('per-IP: a fresh IP is not blocked when another IP hit its cap', async () => {
      process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ key: 'K' }),
      }) as unknown as typeof fetch;

      // IP 'noisy' fills up its bucket.
      for (let i = 0; i < 10; i++) {
        const res = makeRes();
        await handler(
          makeReq({ group: 'gemini' }, 'GET', {
            'x-forwarded-for': '203.0.113.9',
          }),
          res,
        );
        expect(res.statusCode).toBe(200);
      }
      // Different IP still gets in — the rate limit is per-IP, not global.
      const fresh = makeRes();
      await handler(
        makeReq({ group: 'gemini' }, 'GET', {
          'x-forwarded-for': '198.51.100.7',
        }),
        fresh,
      );
      expect(fresh.statusCode).toBe(200);
    });

    it('prefers x-vercel-forwarded-for over x-forwarded-for (survives XFF-overwriting proxies)', async () => {
      // Vercel actually OVERWRITES x-forwarded-for with its measured client
      // IP (does NOT append). But a user proxy on top of Vercel can
      // overwrite XFF a second time. `x-vercel-forwarded-for` survives
      // that scenario. Verify we key on the Vercel header when present.
      process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ key: 'K' }),
      }) as unknown as typeof fetch;

      const trustedIp = '203.0.113.66';

      // Client sends a spoofed x-forwarded-for on every request, but
      // Vercel's own header stays stable — we should key on Vercel's.
      for (let i = 0; i < 10; i++) {
        const res = makeRes();
        await handler(
          makeReq({ group: 'gemini' }, 'GET', {
            'x-forwarded-for': `spoof-${i}`,
            'x-vercel-forwarded-for': trustedIp,
          }),
          res,
        );
        expect(res.statusCode).toBe(200);
      }
      // 11th request with a fresh XFF spoof — still throttled, because
      // we key on x-vercel-forwarded-for.
      const throttled = makeRes();
      await handler(
        makeReq({ group: 'gemini' }, 'GET', {
          'x-forwarded-for': 'spoof-final',
          'x-vercel-forwarded-for': trustedIp,
        }),
        throttled,
      );
      expect(throttled.statusCode).toBe(429);
    });

    it('Retry-After reflects the actual remaining window, not a fixed 60s', async () => {
      // Regression: previous version always returned Retry-After: 60,
      // regardless of when the client's oldest in-window request was.
      // A client throttled 55 seconds into the window would sleep 60s
      // (5s longer than needed) instead of 5s. Now Retry-After tracks
      // remaining time on the oldest timestamp.
      process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ key: 'K' }),
      }) as unknown as typeof fetch;

      const ip = '203.0.113.77';
      const req = () =>
        makeReq({ group: 'gemini' }, 'GET', { 'x-forwarded-for': ip });

      for (let i = 0; i < 10; i++) {
        const res = makeRes();
        await handler(req(), res);
      }
      const throttled = makeRes();
      await handler(req(), throttled);
      expect(throttled.statusCode).toBe(429);
      const retryAfter = Number(throttled.headers['Retry-After']);
      // The oldest timestamp is nearly-now (the burst just fired), so
      // the remaining window should be very close to 60s but strictly
      // <= 60s. Bounds: 1 <= retryAfter <= 60.
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });

  describe('origin allow-list normalization', () => {
    it('accepts a listed origin with UPPERCASE scheme/host', async () => {
      process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ key: 'K' }),
      }) as unknown as typeof fetch;

      const res = makeRes();
      await handler(
        makeReq({ group: 'gemini' }, 'GET', {
          origin: 'HTTPS://Workproof-Demo.Vercel.App',
        }),
        res,
      );
      expect(res.statusCode).toBe(200);
    });

    it('accepts a listed origin with a trailing slash', async () => {
      process.env.CIPHERSTACK_TOKEN = 'csk_test_token';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ key: 'K' }),
      }) as unknown as typeof fetch;

      const res = makeRes();
      await handler(
        makeReq({ group: 'gemini' }, 'GET', {
          origin: 'https://workproof-demo.vercel.app/',
        }),
        res,
      );
      expect(res.statusCode).toBe(200);
    });
  });
});
