/**
 * LLM-backed extraction of structured work-log fields from a free-form
 * transcript (typically dictated by a worker).
 *
 * Strategy: regex baseline first (cheap, deterministic, offline-capable);
 * optionally augment with a Gemini call that fills only the gaps. On numeric
 * conflicts the regex baseline wins, to prevent the LLM from hallucinating
 * inflated amounts.
 */

import { Platform } from "react-native";
import { API_VEND_BASE_URL } from "./config";
import type { ExtractedFields } from "../types";

export type { ExtractedFields };

export interface ExtractOptions {
  /** Set to false to force the regex-only path. Defaults to true. */
  online?: boolean;
}

interface VendedKey {
  key: string;
  baseUrl: string;
}

const KNOWN_WORK_TYPES = [
  "plastering",
  "painting",
  "masonry",
  "electrical",
  "plumbing",
  "loading",
  "cleaning",
  "driver",
  "kitchen",
  "carpentry",
  "mason",
  "helper",
  "labour",
  "gardening",
];

const EMPTY: ExtractedFields = {
  workType: "",
  clientName: "",
  location: "",
  amountReceived: 0,
  amountPending: 0,
  notes: "",
};

/**
 * Vend a Gemini API key from CipherStack. Returns null on any error so the
 * caller can transparently fall back to the regex baseline.
 *
 * Both web AND native route through /api/vend now — the CipherStack service
 * token lives only in the Vercel serverless env, never in the client bundle.
 * Web uses the same-origin `/api/vend?group=gemini`; native (Expo Go / APK)
 * uses the full URL from `API_VEND_BASE_URL`. See workproof task #31.
 */
export async function vendGeminiKey(): Promise<VendedKey | null> {
  try {
    const isWeb = Platform.OS === "web";
    const url = isWeb
      ? "/api/vend?group=gemini"
      : `${API_VEND_BASE_URL}/api/vend?group=gemini`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      key?: string;
      base_url?: string;
    };
    if (!json.key) return null;
    return {
      key: json.key,
      baseUrl:
        json.base_url ?? "https://generativelanguage.googleapis.com/v1beta",
    };
  } catch {
    return null;
  }
}

/**
 * Word-number map for parseAmount. Covers zero..twenty + tens.
 */
const WORD_NUMS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/**
 * Parse a raw amount string. Handles digits ("1500"), comma-separated
 * ("1,500"), shorthand ("1.5k"), and English word-numbers
 * ("thousand five hundred", "two lakh"). Returns 0 on failure.
 */
export function parseAmount(raw: string): number {
  if (!raw) return 0;
  // Strip leading currency tokens before any numeric test — "rs 1500" must
  // parse as 1500, not 0. (The recvMatch regex captures the post-keyword tail
  // but a leading "rs" can still leak through if user dictates "amount rs 1500".)
  const stripped = raw
    .trim()
    .toLowerCase()
    .replace(/^(?:rs\.?|inr|₹|rupees?)\s*/, "");
  const cleaned = stripped.trim();
  if (!cleaned) return 0;

  // Pure number with optional comma separators or decimal: "1,500" / "1500.50"
  const numericMatch = cleaned.match(/^([\d,]+(?:\.\d+)?)$/);
  if (numericMatch) {
    const n = Number(numericMatch[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  // Shorthand: 1.5k / 2 k / 3.5lakh / 1.2cr — allow optional whitespace.
  const shortMatch = cleaned.match(
    /^([\d.]+)\s*(k|thousand|lakh|lac|l|cr|crore|hundred|h)$/,
  );
  if (shortMatch) {
    const base = Number(shortMatch[1]);
    if (!Number.isFinite(base)) return 0;
    const unit = shortMatch[2];
    if (unit === "k" || unit === "thousand") return base * 1000;
    if (unit === "hundred" || unit === "h") return base * 100;
    if (unit === "lakh" || unit === "lac" || unit === "l") return base * 100000;
    if (unit === "cr" || unit === "crore") return base * 10000000;
    return base;
  }

  // "5 thousand" / "2 lakh" — digit followed by a unit word.
  const digitWithUnit = cleaned.match(
    /^([\d,]+(?:\.\d+)?)\s+(k|thousand|lakh|lac|l|cr|crore|hundred|h)$/,
  );
  if (digitWithUnit) {
    const base = Number(digitWithUnit[1].replace(/,/g, ""));
    if (!Number.isFinite(base)) return 0;
    const unit = digitWithUnit[2];
    if (unit === "k" || unit === "thousand") return base * 1000;
    if (unit === "hundred" || unit === "h") return base * 100;
    if (unit === "lakh" || unit === "lac" || unit === "l") return base * 100000;
    if (unit === "cr" || unit === "crore") return base * 10000000;
    return base;
  }

  // Word numbers: "thousand five hundred", "two thousand five hundred"
  // Strip non-letters except spaces and hyphens.
  const tokens = cleaned
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);

  if (tokens.length === 0) return 0;

  let total = 0;
  let current = 0;
  let matched = false;

  for (const tok of tokens) {
    if (tok in WORD_NUMS) {
      current += WORD_NUMS[tok];
      matched = true;
      continue;
    }
    if (tok === "hundred") {
      current = (current === 0 ? 1 : current) * 100;
      matched = true;
      continue;
    }
    if (tok === "thousand") {
      current = (current === 0 ? 1 : current) * 1000;
      total += current;
      current = 0;
      matched = true;
      continue;
    }
    if (tok === "lakh" || tok === "lac") {
      current = (current === 0 ? 1 : current) * 100000;
      total += current;
      current = 0;
      matched = true;
      continue;
    }
    if (tok === "crore") {
      current = (current === 0 ? 1 : current) * 10000000;
      total += current;
      current = 0;
      matched = true;
      continue;
    }
    if (tok === "and") continue;
    // Unknown token — ignore but don't fail.
  }

  if (!matched) return 0;
  return total + current;
}

/**
 * Pure-regex extraction. Always returns a complete ExtractedFields object
 * (missing fields default to "" / 0).
 */
export function regexExtract(transcript: string): ExtractedFields {
  if (!transcript || typeof transcript !== "string") {
    return { ...EMPTY };
  }

  const out: ExtractedFields = { ...EMPTY };
  const lower = transcript.toLowerCase();

  // workType — try the known list first (single word), else verb-driven phrase.
  let workType = "";
  for (const w of KNOWN_WORK_TYPES) {
    const re = new RegExp(`\\b${w}\\b`, "i");
    if (re.test(transcript)) {
      workType = w;
      break;
    }
  }
  if (!workType) {
    const m = transcript.match(
      /(?:did|doing|working on|finished)\s+([a-z\s]+?)(?:\s+work|\s+for|\.|$)/i,
    );
    if (m && m[1]) workType = m[1].trim().toLowerCase();
  }
  out.workType = workType;

  // location — match before clientName so "at Green Valley" lands here.
  const locMatch = transcript.match(
    /(?:in|near|at site|at)\s+([A-Z][\w\s,.-]+?)(?:[.,]|$)/,
  );
  if (locMatch && locMatch[1]) {
    out.location = locMatch[1].trim();
  }

  // clientName — only "for" introduces a client name (drops the "at"
  // alternation that double-captured the same span as location).
  const clientMatch = transcript.match(
    /\bfor\s+([A-Z][\w\s&.]+?)(?:\s+(?:in|near|at|today|yesterday)|[.,]|$)/,
  );
  if (clientMatch && clientMatch[1]) {
    const candidate = clientMatch[1].trim();
    // Last-line guard: if for some reason clientName equals location, drop it.
    if (candidate.toLowerCase() !== out.location.toLowerCase()) {
      out.clientName = candidate;
    }
  }

  // amountReceived — try the unit-suffix branch FIRST so "5 thousand" parses
  // as 5000 instead of capturing "5" via the bare-digit branch (1000x bug).
  // crore added to the unit list.
  const recvMatch = lower.match(
    /(?:got|received|paid|earned|₹|rs\.?|inr)\s*([a-z\s-]+(?:hundred|thousand|lakh|crore|lac|cr)|[\d,]+(?:\.\d+)?\s*(?:k|thousand|lakh|lac|l|cr|crore|hundred|h)?|[\d,]+(?:\.\d+)?)/i,
  );
  if (recvMatch && recvMatch[1]) {
    out.amountReceived = parseAmount(recvMatch[1]);
  }

  // amountPending — same alternation order.
  const pendMatch = lower.match(
    /(?:pending|balance|remaining|due|owe[sd]?|left)\s*(?:is|of|:)?\s*(?:₹|rs\.?|inr)?\s*([a-z\s-]+(?:hundred|thousand|lakh|crore|lac|cr)|[\d,]+(?:\.\d+)?\s*(?:k|thousand|lakh|lac|l|cr|crore|hundred|h)?|[\d,]+(?:\.\d+)?)/i,
  );
  if (pendMatch && pendMatch[1]) {
    out.amountPending = parseAmount(pendMatch[1]);
  }

  // notes — bound to a sentence-ish span so a 2000-char dictation without a
  // period doesn't dump the whole transcript here (already stored separately).
  const notesMatch = transcript.match(
    /(?:still\s+(?:need|have)|left to do|remaining work|need to)\s+(.{1,180}?)(?:[.!?]|$)/i,
  );
  if (notesMatch && notesMatch[1]) {
    out.notes = notesMatch[1].trim();
  }

  return out;
}

/**
 * Merge a Gemini-derived ExtractedFields onto a regex baseline.
 * - String fields: LLM fills gaps (only used when baseline field is empty).
 * - Numeric fields: regex baseline always wins when non-zero (prevents
 *   hallucinated inflated amounts).
 */
function mergeBaseline(
  baseline: ExtractedFields,
  llm: Partial<ExtractedFields>,
): ExtractedFields {
  return {
    workType: baseline.workType || (llm.workType ?? "") || "",
    clientName: baseline.clientName || (llm.clientName ?? "") || "",
    location: baseline.location || (llm.location ?? "") || "",
    amountReceived:
      baseline.amountReceived !== 0
        ? baseline.amountReceived
        : llm.amountReceived ?? 0,
    amountPending:
      baseline.amountPending !== 0
        ? baseline.amountPending
        : llm.amountPending ?? 0,
    notes: baseline.notes || (llm.notes ?? "") || "",
  };
}

/**
 * Call Gemini with the transcript, return a partial ExtractedFields or null
 * on any failure. Caller is responsible for merging.
 */
async function geminiExtract(
  transcript: string,
): Promise<Partial<ExtractedFields> | null> {
  const vended = await vendGeminiKey();
  if (!vended) return null;

  const prompt = `Extract structured fields from this worker's spoken work log. Return ONLY a JSON object with keys: workType (string), clientName (string), location (string), amountReceived (number), amountPending (number), notes (string). Use 0 for unknown numbers and "" for unknown strings. Do not include any other text.\n\nTranscript: ${transcript}`;

  try {
    const url = `${vended.baseUrl.replace(/\/$/, "")}/models/gemini-1.5-flash:generateContent?key=${vended.key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as Partial<ExtractedFields>;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Extract structured work fields from a free-form transcript.
 *
 * Always returns a complete ExtractedFields object. Defaults to OFFLINE,
 * on-device regex extraction (the spec requires no network round-trip for
 * the worker's transcript). To opt into the LLM-backed augmentation, pass
 * `{ online: true }` explicitly.
 */
export async function extractWorkFields(
  transcript: string,
  opts?: ExtractOptions,
): Promise<ExtractedFields> {
  const baseline = regexExtract(transcript);
  if (opts?.online !== true) return baseline;

  const llm = await geminiExtract(transcript);
  if (!llm) return baseline;

  return mergeBaseline(baseline, llm);
}

/**
 * Translate a transcript from any source language to a named target
 * language via Gemini. Returns null on any failure so the caller can
 * gracefully fall back to the original transcript.
 *
 * Impact-in-India angle: many field crews dictate their voice memos in
 * Kannada / Tamil / Hindi / Marathi / Bengali but clients (property
 * managers, insurance adjusters, remote homeowners) often want the PDF
 * in English or another common language. This gives WorkProof a
 * cross-language proof-of-work story without forcing the crew to write
 * in a language they don't speak.
 *
 * Currently uses the same gemini-1.5-flash model the extractor uses.
 * On hackathon day this switches to `gemini-3.5-live-translate-preview`
 * once the day-of credentials are provisioned — see
 * https://ai.google.dev/gemini-api/docs/live-translate.
 */
export async function translateTranscript(
  transcript: string,
  targetLanguage: string,
): Promise<string | null> {
  const trimmed = transcript.trim();
  if (!trimmed) return null;
  const target = targetLanguage.trim();
  if (!target) return null;

  const vended = await vendGeminiKey();
  if (!vended) return null;

  const prompt = `Translate this worker's spoken work log into ${target}. Preserve numbers, names, and any technical terms exactly (do not localize proper nouns like "Sharma Construction"). Return ONLY the translated text — no quotes, no commentary, no prefix like "Translation:".\n\nOriginal:\n${trimmed}`;

  try {
    const url = `${vended.baseUrl.replace(/\/$/, "")}/models/gemini-1.5-flash:generateContent?key=${vended.key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return text.trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Inline fixtures — sanity checks run only in dev. They exercise the regex
// path (no network) and the parseAmount helper.
// ---------------------------------------------------------------------------

declare const __DEV__: boolean | undefined;

if (typeof __DEV__ !== "undefined" && __DEV__) {
  // 1) Plastering for a named client with received + pending amounts.
  const f1 = regexExtract(
    "Did plastering for Sharma Construction in Andheri. Got 5000, pending 2500.",
  );
  console.assert(
    f1.workType === "plastering",
    "fixture1 workType",
    f1.workType,
  );
  console.assert(
    f1.amountReceived === 5000,
    "fixture1 received",
    f1.amountReceived,
  );
  console.assert(
    f1.amountPending === 2500,
    "fixture1 pending",
    f1.amountPending,
  );

  // 2) Word-number amount.
  const f2 = regexExtract(
    "Did painting work for Mehta Builders. Received fifteen hundred rupees.",
  );
  console.assert(f2.workType === "painting", "fixture2 workType", f2.workType);
  console.assert(
    f2.amountReceived === 1500,
    "fixture2 received",
    f2.amountReceived,
  );

  // 3) Shorthand "1.5k".
  const f3 = parseAmount("1.5k");
  console.assert(f3 === 1500, "fixture3 parseAmount 1.5k", f3);

  // 4) Lakh shorthand.
  const f4 = parseAmount("2 lakh");
  console.assert(f4 === 200000, "fixture4 parseAmount 2 lakh", f4);

  // 5) Verb-driven workType + location.
  const f5 = regexExtract(
    "Working on kitchen renovation at Green Valley. Pending 3000.",
  );
  console.assert(
    f5.workType === "kitchen",
    "fixture5 workType",
    f5.workType,
  );
  console.assert(
    f5.amountPending === 3000,
    "fixture5 pending",
    f5.amountPending,
  );
}
