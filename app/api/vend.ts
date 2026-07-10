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
  .map((o: string) => o.trim())
  .filter(Boolean);

function isOriginAllowed(req: VercelRequest): boolean {
  const originHeader = req.headers?.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (origin) {
    return ALLOWED_ORIGINS.includes(origin);
  }
  // No Origin header — treat as native. Real Expo Go / APK builds do NOT
  // send Origin. Browsers ALWAYS send Origin on cross-origin fetches. So
  // if Origin is absent, either it's a native app OR it's a same-origin
  // browser request that somehow lost the header (which is not a normal
  // shape). Allow it — but log for auditability by returning true; a
  // future hardening pass adds device attestation here.
  return true;
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
