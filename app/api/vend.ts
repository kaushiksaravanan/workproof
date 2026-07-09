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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  if (req.method && req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
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
