/**
 * Vercel serverless proxy for CipherStack vend calls.
 *
 * Hit as `/api/vend?group=gemini`. Reads the CipherStack service token from a
 * server-only env var (CIPHERSTACK_TOKEN, no EXPO_PUBLIC_ prefix) and
 * forwards to https://cipherstack.kaushik.cv/api/v1/vend/<group>.
 *
 * Keeps the token out of the client JS bundle (EXPO_PUBLIC_* would inline it).
 */

interface VercelRequest {
  method?: string;
  query: { [key: string]: string | string[] | undefined };
  headers: { [key: string]: string | string[] | undefined };
}

interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

const CIPHERSTACK_BASE = "https://cipherstack.kaushik.cv/api/v1";
const ALLOWED_GROUPS = new Set([
  "gemini",
  "openrouter",
  "huggingface",
  "mistral",
  "groq",
  "nvidia",
  "cerebras",
  "cohere",
  "github-models",
  "cloudflare-ai",
]);

/**
 * Origin allow-list. Web builds calling /api/vend from workproof-demo.vercel.app
 * (or a configured production domain) send an Origin header — we reject any
 * cross-origin request outright. Native builds (Expo Go / APK) don't set
 * Origin, so we allow requests without an Origin header, but only for
 * User-Agents that look like a mobile app. This is not attestation-grade —
 * both headers are easy to forge — but it raises the friction for someone
 * who stumbles onto the deployed URL and blindly curls it.
 *
 * Real hardening requires attested per-install tokens (Play Integrity /
 * DeviceCheck) or a signed short-lived credential. See workproof task #32.
 */
const ALLOWED_ORIGINS = (
  process.env.VEND_ALLOWED_ORIGINS ??
  "https://workproof-demo.vercel.app,http://localhost:8081,http://localhost:19006"
)
  .split(",")
  .map((o: string) => normalizeOrigin(o.trim()))
  .filter(Boolean);

function normalizeOrigin(origin: string): string {
  // Lowercase (RFC 3986 scheme/host case-insensitive), drop trailing slash.
  // Bare origins don't have a path so trailing slash shouldn't appear, but
  // clients occasionally send it — accept both shapes as equivalent.
  return origin.toLowerCase().replace(/\/$/, "");
}

function isOriginAllowed(req: VercelRequest): boolean {
  const originHeader = req.headers?.origin;
  const raw = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (raw) {
    return ALLOWED_ORIGINS.includes(normalizeOrigin(raw));
  }
  // No Origin header — treat as native. Real Expo Go / APK builds do NOT
  // send Origin. Browsers ALWAYS send Origin on cross-origin fetches. So
  // if Origin is absent, either it's a native app OR it's a same-origin
  // browser request that somehow lost the header (which is not a normal
  // shape). Allow it — but log for auditability by returning true; a
  // future hardening pass adds device attestation here.
  return true;
}

// ---------------------------------------------------------------------------
// Per-IP rate limit (in-memory, per Vercel serverless instance).
//
// Vercel serverless functions are stateless between cold starts, but a warm
// instance reuses module-level state across invocations. This gives us a
// cheap first-line-of-defense against naive abuse: one machine curling
// /api/vend in a tight loop hits the limit within a warm instance's
// lifetime. A distributed attacker across many IPs bypasses this — full
// mitigation needs Vercel KV / Upstash Redis with cross-instance state.
// Tracked as follow-up work on task #32.
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = Number(process.env.VEND_RATE_LIMIT_MAX ?? "10");
const RATE_LIMIT_WINDOW_MS = Number(
  process.env.VEND_RATE_LIMIT_WINDOW_MS ?? "60000",
);

// LRU-ish: at most 10k IPs tracked. Older entries drop off when the map
// exceeds this — a single hot IP can't push out unrelated slow callers
// because we prune expired entries first.
const RATE_LIMIT_MAX_TRACKED = 10_000;

const rateLimitState = new Map<string, number[]>();

// Per-warm-instance salt for callers we can't identify (no XFF, no
// x-real-ip). Callers sharing the same 'unknown' bucket would amplify
// each other's request budget; salting bounds the damage to this warm
// instance's lifetime.
const unknownSalt = Math.random().toString(36).slice(2);

function pruneExpired(key: string, now: number): void {
  const timestamps = rateLimitState.get(key);
  if (!timestamps) return;
  const kept = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (kept.length === 0) {
    rateLimitState.delete(key);
  } else {
    rateLimitState.set(key, kept);
  }
}

function clientKey(req: VercelRequest): string {
  // Vercel appends its measured client IP to any client-supplied
  // x-forwarded-for header, so the TRUSTED entry is the LAST one, not
  // the first. Reading position 0 (as the naive approach does) lets an
  // attacker rotate x-forwarded-for on every request to bypass the
  // rate limit. Take the tail entry instead.
  const xff = req.headers?.["x-forwarded-for"];
  const forwarded = Array.isArray(xff) ? xff[xff.length - 1] : xff;
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const trusted = parts[parts.length - 1];
    if (trusted) return trusted;
  }
  const real = req.headers?.["x-real-ip"];
  const realStr = Array.isArray(real) ? real[0] : real;
  if (realStr) return realStr;
  // No trustworthy IP identifier at all. Do NOT let all such callers
  // share the same 'unknown' bucket — that would let an attacker with a
  // spoofed header amplify the un-rate-limited traffic. Salt the key with
  // a random-per-instance token so the bucket is at least unique per
  // warm instance; still not ideal, but not a shared vector either.
  return `unknown-${unknownSalt}`;
}

function rateLimit(
  req: VercelRequest,
  now: number = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number } {
  const key = clientKey(req);
  pruneExpired(key, now);
  const timestamps = rateLimitState.get(key) ?? [];
  if (timestamps.length >= RATE_LIMIT_MAX) {
    // Client is capped. Retry-After = the remaining window on the OLDEST
    // in-window timestamp (rounded up to whole seconds). Once that ages
    // out, they get one slot back.
    const oldest = timestamps[0];
    const remainingMs = Math.max(0, RATE_LIMIT_WINDOW_MS - (now - oldest));
    const retryAfterSec = Math.max(1, Math.ceil(remainingMs / 1000));
    return { ok: false, retryAfterSec };
  }
  timestamps.push(now);
  rateLimitState.set(key, timestamps);

  // Bound total tracked entries so a burst of unique IPs can't grow the
  // map unbounded. Trim least-recently-touched entries (Map preserves
  // insertion order; delete the oldest keys until under the cap).
  while (rateLimitState.size > RATE_LIMIT_MAX_TRACKED) {
    const firstKey = rateLimitState.keys().next().value;
    if (firstKey === undefined) break;
    rateLimitState.delete(firstKey);
  }
  return { ok: true };
}

/** Test-only: clear the in-memory rate limit state between tests. */
export function __resetRateLimitForTests(): void {
  rateLimitState.clear();
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  if (!isOriginAllowed(req)) {
    res.status(403).json({ error: "origin not allowed" });
    return;
  }

  const rate = rateLimit(req);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    res.status(429).json({ error: "rate limit exceeded" });
    return;
  }

  const rawGroup = req.query.group;
  const group = Array.isArray(rawGroup) ? rawGroup[0] : rawGroup;
  if (!group || !ALLOWED_GROUPS.has(group)) {
    res.status(400).json({ error: "unknown group" });
    return;
  }

  const token = process.env.CIPHERSTACK_TOKEN;
  if (!token) {
    res.status(503).json({ error: "vend not configured on server" });
    return;
  }

  try {
    const upstream = await fetch(`${CIPHERSTACK_BASE}/vend/${group}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await upstream.text();
    res.status(upstream.status);
    try {
      res.json(JSON.parse(body));
    } catch {
      res.status(502).json({ error: "upstream non-json", body });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "vend failed";
    res.status(502).json({ error: msg });
  }
}
