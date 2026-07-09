import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { WorkRecord, ProofDocument } from "../types";
import { explorerUrl } from "./anchor";
import { isAnchored, chunkHashJoined } from "../utils/record";

// ---------------- helpers ----------------

function escapeHtml(input: string | undefined | null): string {
  if (input === undefined || input === null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Whitelist URL schemes for the photo `<img src>` so that a hostile (or
 * accidentally pasted) javascript: / data:text/html / vbscript: URI cannot
 * end up live-rendered if the proof HTML is ever shared somewhere other
 * than expo-print's PDF pipeline (which is inert anyway).
 */
const SAFE_PHOTO_SCHEME = /^(?:file|content|https?):/i;
const SAFE_DATA_IMAGE = /^data:image\/[a-zA-Z0-9+.-]+;/i;

function safePhotoUri(uri: string | undefined | null): string {
  if (!uri || typeof uri !== "string") return "";
  return SAFE_PHOTO_SCHEME.test(uri) || SAFE_DATA_IMAGE.test(uri) ? uri : "";
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function splitWorkerName(full: string | undefined): { first: string; last: string } {
  const trimmed = (full ?? "").trim();
  if (!trimmed) return { first: "", last: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return { first, last };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

// ---------------- HTML ----------------

export function buildProofHtml(rec: WorkRecord): string {
  const { first, last } = splitWorkerName(rec.workerName);
  const anchored = isAnchored(rec);
  const explorer =
    anchored && rec.anchorTxHash
      ? explorerUrl(rec.anchorTxHash)
      : "";

  const chunkedHash = chunkHashJoined(rec.hash);
  const photoSrc = safePhotoUri(rec.photoUri);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WorkProof — ${escapeHtml(rec.workType || "Proof")}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,wght@0,400;0,600;1,400;1,600&display=swap');

    @page { size: A4; margin: 16mm; }

    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #001A33;
      background: #E3E3E3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .header {
      background: #7DA1FF;
      color: #FFFFFF;
      padding: 28px 32px;
      border-radius: 24px 24px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }
    .header h1 {
      margin: 0;
      font-family: 'Fraunces', serif;
      font-weight: 600;
      font-size: 32px;
      letter-spacing: -0.5px;
    }
    .header .tagline {
      font-size: 13px;
      opacity: 0.9;
      margin-top: 4px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 500;
    }
    .planes {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .planes svg { display: block; }

    .card {
      background: #FFFFFF;
      padding: 36px 40px 32px;
      border-radius: 0 0 24px 24px;
      box-shadow: 0 8px 32px rgba(125, 161, 255, 0.08);
    }

    .worker {
      font-family: 'Fraunces', serif;
      font-weight: 600;
      font-size: 36px;
      line-height: 1.1;
      margin: 0 0 4px 0;
      color: #001A33;
    }
    .worker .last {
      background: linear-gradient(
        180deg,
        transparent 0%,
        transparent 62%,
        #FFD84D 62%,
        #FFD84D 92%,
        transparent 92%,
        transparent 100%
      );
      padding: 0 4px;
    }
    .meta {
      color: #6B7280;
      font-size: 13px;
      margin: 0 0 24px 0;
      font-weight: 500;
    }

    table.fields {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 0 0 28px 0;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #E5E7EB;
    }
    table.fields tr.header-row td {
      background: #CAD9F6;
      color: #001A33;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 10px 16px;
      width: 38%;
    }
    table.fields tr.header-row td.value-col {
      background: #CAD9F6;
      color: #001A33;
      width: 62%;
    }
    table.fields td {
      padding: 14px 16px;
      vertical-align: top;
      font-size: 14px;
      border-top: 1px solid #E5E7EB;
    }
    table.fields td.label {
      background: #CAD9F6;
      color: #001A33;
      font-weight: 600;
      width: 38%;
    }
    table.fields td.value {
      background: #FFFFFF;
      color: #001A33;
      font-weight: 500;
    }

    .section-title {
      font-family: 'Fraunces', serif;
      font-weight: 600;
      font-size: 20px;
      margin: 28px 0 12px 0;
      color: #001A33;
    }

    .transcript {
      background-color: #FFFFFF;
      background-image:
        linear-gradient(
          to bottom,
          transparent 31px,
          rgba(125, 161, 255, 0.18) 31px,
          rgba(125, 161, 255, 0.18) 32px,
          transparent 32px
        ),
        linear-gradient(
          to right,
          transparent 39px,
          rgba(240, 68, 91, 0.35) 39px,
          rgba(240, 68, 91, 0.35) 40px,
          transparent 40px
        );
      background-size: 100% 32px, 100% 100%;
      background-repeat: repeat-y, no-repeat;
      padding: 16px 24px 16px 56px;
      border-radius: 16px;
      border: 1px solid #E5E7EB;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 14px;
      line-height: 32px;
      color: #001A33;
      white-space: pre-wrap;
      word-wrap: break-word;
      min-height: 96px;
    }

    .photo-wrap {
      margin: 24px 0;
      text-align: center;
    }
    .photo-wrap img {
      max-width: 480px;
      width: 100%;
      border-radius: 20px;
      box-shadow: 0 4px 16px rgba(0, 26, 51, 0.12);
    }

    .hash-block {
      background: #E3E3E3;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 14px 16px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      letter-spacing: 0.5px;
      color: #001A33;
      word-break: break-all;
      line-height: 1.6;
    }

    .verify-row {
      display: flex;
      gap: 24px;
      align-items: center;
      margin-top: 20px;
    }
    .verify-text {
      flex: 1;
      font-size: 13px;
      color: #6B7280;
      line-height: 1.5;
    }
    .verify-text a {
      color: #7DA1FF;
      text-decoration: none;
      font-weight: 600;
      word-break: break-all;
    }
    .qr {
      width: 160px;
      height: 160px;
      border-radius: 12px;
      border: 1px solid #E5E7EB;
      padding: 6px;
      background: #FFFFFF;
    }

    .footer {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px dashed #E5E7EB;
      text-align: center;
      font-family: 'Fraunces', serif;
      font-style: italic;
      font-weight: 400;
      font-size: 14px;
      color: #6B7280;
    }
    .footer .verification {
      display: block;
      margin-top: 6px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-style: normal;
      font-size: 11px;
      color: #8A8AA3;
      letter-spacing: 0.3px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>WorkProof</h1>
      <div class="tagline">Receipt of work — hashed, anchored, portable.</div>
    </div>
    <div class="planes">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 3L3 10.5L9 13.5L12 21L21 3Z" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round" fill="rgba(255,255,255,0.18)"/>
      </svg>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 3L3 10.5L9 13.5L12 21L21 3Z" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round" fill="rgba(255,255,255,0.30)"/>
      </svg>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 3L3 10.5L9 13.5L12 21L21 3Z" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round" fill="rgba(255,255,255,0.45)"/>
      </svg>
    </div>
  </div>

  <div class="card">
    <h2 class="worker">${escapeHtml(first)}${first && last ? " " : ""}<span class="last">${escapeHtml(last)}</span></h2>
    <p class="meta">Issued ${escapeHtml(formatDate(rec.createdAt))} · Receipt #${escapeHtml(rec.id.slice(0, 8))}</p>

    <table class="fields">
      <tr class="header-row">
        <td>Field</td>
        <td class="value-col">Value</td>
      </tr>
      <tr>
        <td class="label">Work</td>
        <td class="value">${escapeHtml(rec.workType) || "—"}</td>
      </tr>
      <tr>
        <td class="label">Client</td>
        <td class="value">${escapeHtml(rec.clientName) || "—"}</td>
      </tr>
      <tr>
        <td class="label">Location</td>
        <td class="value">${escapeHtml(rec.location) || "—"}</td>
      </tr>
      <tr>
        <td class="label">Amount received</td>
        <td class="value">${escapeHtml(formatAmount(rec.amountReceived))}</td>
      </tr>
      <tr>
        <td class="label">Amount pending</td>
        <td class="value">${escapeHtml(formatAmount(rec.amountPending))}</td>
      </tr>
      <tr>
        <td class="label">Notes</td>
        <td class="value">${escapeHtml(rec.notes) || "—"}</td>
      </tr>
    </table>

    <div class="section-title">Transcript</div>
    <div class="transcript">${escapeHtml(rec.transcript) || "—"}</div>

    ${
      photoSrc
        ? `<div class="section-title">Photo</div>
    <div class="photo-wrap">
      <img src="${escapeHtml(photoSrc)}" alt="Work photo" />
    </div>`
        : ""
    }

    <div class="section-title">Content hash</div>
    <div class="hash-block">${escapeHtml(chunkedHash)}</div>

    <div class="verify-row">
      <div class="verify-text">
        ${
          anchored
            ? `Anchored on-chain. Verify by visiting:<br/><a href="${escapeHtml(
                explorer
              )}">${escapeHtml(explorer)}</a>`
            : "Not yet anchored. Anchor this record on-chain in the WorkProof app to make the timestamp independently verifiable."
        }
      </div>
    </div>

    <div class="footer">
      Made with love · WorkProof
      <span class="verification">
        Verify integrity by re-hashing the canonical record.
        Recipe: SHA-256 of raw photo bytes (lowercase hex), SHA-256 of raw audio
        bytes if any (lowercase hex), substitute those into the record's
        photoUri / audioUri fields, sort top-level keys alphabetically,
        JSON.stringify, then SHA-256 of the resulting UTF-8 bytes (lowercase
        hex). Match against the hash above.
      </span>
    </div>
  </div>
</body>
</html>`;
}

// ---------------- PDF ----------------

export async function generateProofPdf(rec: WorkRecord): Promise<ProofDocument> {
  const html = buildProofHtml(rec);
  const { uri } = await Print.printToFileAsync({ html });
  return {
    record: rec,
    pdfUri: uri,
    generatedAt: new Date().toISOString(),
  };
}

export async function shareProofPdf(uri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) return;
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Share proof",
  });
}
