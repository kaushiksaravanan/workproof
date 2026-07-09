/**
 * Unit tests for the /api/vend Vercel serverless proxy.
 *
 * These exercise the handler with fake VercelRequest/VercelResponse objects
 * and a stubbed global fetch, so no network / no CipherStack round-trip.
 */

import handler from '../vend';

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
): { method: string; query: Record<string, string | undefined> } {
  return { method, query };
}

const CIPHERSTACK_BASE = 'https://cipherstack.kaushik.cv/api/v1';
const ORIGINAL_ENV = process.env.CIPHERSTACK_TOKEN;
const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.CIPHERSTACK_TOKEN;
  else process.env.CIPHERSTACK_TOKEN = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
  jest.restoreAllMocks();
});

describe('/api/vend', () => {
  it('always sets Cache-Control: no-store', async () => {
    const res = makeRes();
    await handler(makeReq({ group: 'nope' }), res);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('returns 405 for non-GET methods', async () => {
    const res = makeRes();
    await handler(makeReq({ group: 'gemini' }, 'POST'), res);
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'method not allowed' });
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
      { method: 'GET', query: { group: ['gemini', 'other'] } } as unknown as {
        method: string;
        query: Record<string, string | undefined>;
      },
      res,
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${CIPHERSTACK_BASE}/vend/gemini`);
    expect(res.statusCode).toBe(200);
  });
});
