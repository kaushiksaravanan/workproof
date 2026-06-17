// Build WorkProof Technical Document (.docx)
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat, ExternalHyperlink,
  TabStopType, TabStopPosition, SectionType,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak,
} = require("docx");

const OUT_PATH = "C:/Users/I587436/projects/workproof/docs/WorkProof-Technical-Document.docx";
const DOODLE_PATH = "C:/Users/I587436/projects/workproof/_styleguide/peggy-export/assets/peggy-mom-doodle.png";

// Peggy palette
const PEGGY_BLUE = "7DA1FF";
const PEGGY_LAVENDER = "CAD9F6";
const PEGGY_INK = "001A33";
const PEGGY_HAIRLINE = "E5E7EB";
const PEGGY_GRAY = "6B7280";

// Page size: US Letter
const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN; // 9360

// Cell border
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: PEGGY_HAIRLINE };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

// Helpers
function P(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before ?? 60, after: opts.after ?? 60, line: 300 },
    alignment: opts.alignment,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color, size: opts.size, font: opts.font })],
  });
}

function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text, bold: true, color: PEGGY_INK })],
  });
}

function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, color: PEGGY_INK })],
  });
}

function H3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 100 },
    children: [new TextRun({ text, bold: true, color: PEGGY_INK })],
  });
}

function bullet(text, level = 0, runs = null) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 40, after: 40, line: 290 },
    children: runs ?? [new TextRun({ text })],
  });
}

function bulletRich(parts, level = 0) {
  // parts: array of { text, bold?, italics?, code? }
  const runs = parts.map(p => new TextRun({
    text: p.text,
    bold: p.bold,
    italics: p.italics,
    font: p.code ? "Consolas" : undefined,
    size: p.code ? 20 : undefined,
  }));
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 40, after: 40, line: 290 },
    children: runs,
  });
}

function code(text) {
  // monospace paragraph
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 280 },
    shading: { fill: "F3F4F6", type: ShadingType.CLEAR, color: "auto" },
    children: [new TextRun({ text, font: "Consolas", size: 20 })],
  });
}

function makeHeaderRow(headers, widths) {
  return new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders: cellBorders,
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: PEGGY_LAVENDER, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: h, bold: true, color: PEGGY_INK })],
      })],
    })),
  });
}

function makeBodyRow(cells, widths) {
  return new TableRow({
    children: cells.map((c, i) => new TableCell({
      borders: cellBorders,
      width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      verticalAlign: VerticalAlign.TOP,
      children: Array.isArray(c)
        ? c
        : [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: String(c) })] })],
    })),
  });
}

function makeTable(widths, headers, rows) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      makeHeaderRow(headers, widths),
      ...rows.map(r => makeBodyRow(r, widths)),
    ],
  });
}

// =============================================================================
// COVER PAGE
// =============================================================================
const doodleData = fs.readFileSync(DOODLE_PATH);
// natural 768x896. target ~ 220 wide -> 220 * 896/768 = 256.6
const DOODLE_W = 220;
const DOODLE_H = Math.round(DOODLE_W * 896 / 768);

// Build a cover-page band as a single-cell table colored PeggyBlue, full width
function coverBand() {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        height: { value: 4200, rule: "atLeast" },
        children: [new TableCell({
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "auto" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
            left: { style: BorderStyle.NONE, size: 0, color: "auto" },
            right: { style: BorderStyle.NONE, size: 0, color: "auto" },
          },
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          shading: { fill: PEGGY_BLUE, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 720, bottom: 720, left: 600, right: 600 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { before: 240, after: 120 },
              children: [new TextRun({ text: "WorkProof", bold: true, size: 96, color: PEGGY_INK, font: "Arial" })],
            }),
            new Paragraph({
              spacing: { before: 60, after: 240 },
              children: [new TextRun({ text: "Receipts for the work that doesn't show up.", italics: true, size: 32, color: PEGGY_INK, font: "Fraunces" })],
            }),
            new Paragraph({
              spacing: { before: 120, after: 0 },
              children: [new TextRun({ text: "Technical Document", bold: true, size: 28, color: PEGGY_INK, font: "Arial" })],
            }),
          ],
        })],
      }),
    ],
  });
}

const coverChildren = [
  coverBand(),
  new Paragraph({ spacing: { before: 240, after: 240 }, children: [new TextRun({ text: "" })] }),
  new Paragraph({
    spacing: { before: 120, after: 120 },
    children: [new TextRun({ text: "Field-tech receipts that survive offline shifts and convince payers.", color: PEGGY_INK, size: 26 })],
  }),
  new Paragraph({
    spacing: { before: 60, after: 120 },
    children: [new TextRun({ text: "Version 1.0  ·  June 2026", color: PEGGY_GRAY, size: 22 })],
  }),
  // Doodle, right aligned, near the bottom
  new Paragraph({ spacing: { before: 2400, after: 0 }, alignment: AlignmentType.RIGHT,
    children: [new ImageRun({
      type: "png",
      data: doodleData,
      transformation: { width: DOODLE_W, height: DOODLE_H },
      altText: { name: "Peggy mom doodle", description: "Hand-drawn Peggy character illustration", title: "Peggy" },
    })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// =============================================================================
// TABLE OF CONTENTS
// =============================================================================
const tocChildren = [
  H1("Contents"),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({ children: [new PageBreak()] }),
];

// =============================================================================
// 1. PROBLEM
// =============================================================================
const problemChildren = [
  H1("1. Problem"),
  P("Field technicians, contractors, social workers, and other on-site professionals routinely complete work that is invisible to the systems and people who pay for it. They drive somewhere, fix something, leave, and only then do they begin a second, unpaid job: justifying that the work happened.", { after: 160 }),

  H2("1.1 The pain points"),
  bulletRich([{ text: "Disputed visits.", bold: true }, { text: " Customers and payers ask, “were you actually on site?” and ask it after the work is done." }]),
  bulletRich([{ text: "Reconstruction tax.", bold: true }, { text: " Workers stitch together photos, GPS pings, screenshots, paper logs, and memory at the end of the day, often hours after the fact." }]),
  bulletRich([{ text: "Connectivity holes.", bold: true }, { text: " Basements, rural lots, industrial sites, and underground mechanical rooms have no signal. Tools that require a network in the moment fail in exactly the places workers need them most." }]),
  bulletRich([{ text: "No portable proof.", bold: true }, { text: " Existing evidence (a photo on a phone, a row in a CRM, a note in dispatch) is trivially editable, hard to share, and impossible for a third party to verify without trust in the issuer." }]),
  bulletRich([{ text: "Slow payment, unpaid disputes.", bold: true }, { text: " Without crisp evidence, invoices get held, claw-backs happen weeks later, and the worker eats the loss." }]),

  H2("1.2 Who feels this"),
  bullet("Independent contractors and small field-services businesses (HVAC, plumbing, locksmith, pest, electrical, IT)."),
  bullet("Insurance and warranty adjusters working in homes and on roofs."),
  bullet("Home-health aides, social workers, and inspectors."),
  bullet("Gig delivery and rideshare drivers when a drop-off is contested."),
  bullet("Telecom and utility crews working in rural and underground sites."),

  H2("1.3 Why now"),
  P("Phones now ship secure enclaves, hardware-attested signing keys, and high-precision GNSS and barometers. App stores allow apps to write to durable on-device storage and sync opportunistically. Public timestamping (RFC 3161, OpenTimestamps via Bitcoin) is cheap and widely accepted. The pieces to make a tamper-evident, offline-first “receipt” exist in every shipped phone — they just have not been wired together for the field-services use case."),
];

// =============================================================================
// 2. SOLUTION
// =============================================================================
const solutionChildren = [
  H1("2. Solution"),
  P("WorkProof is a mobile app that produces a tamper-evident, third-party-verifiable receipt every time a worker completes a unit of work in the field. The receipt is created on the worker’s device, in the moment, and is independently verifiable by anyone who is given a link — without trusting WorkProof.", { after: 160 }),

  H2("2.1 What a WorkProof receipt is"),
  P("A receipt is a small, signed JSON document plus an optional bundle of evidence (photos, audio, location, sensor traces). It captures the answers to the four questions every dispute returns to:"),
  bulletRich([{ text: "Who", bold: true }, { text: " did the work — a worker identity bound to a device key." }]),
  bulletRich([{ text: "What", bold: true }, { text: " was done — a job description, optional checklist, photos, voice note." }]),
  bulletRich([{ text: "Where", bold: true }, { text: " it happened — GNSS fix with accuracy, optional barometric altitude, geofence anchor." }]),
  bulletRich([{ text: "When", bold: true }, { text: " — device-local time and a public timestamp committed once connectivity returns." }]),

  H2("2.2 Design tenets"),
  bulletRich([{ text: "Offline-first.", bold: true }, { text: " The app never requires connectivity to record a receipt. Sync is opportunistic." }]),
  bulletRich([{ text: "Tamper-evident, not tamper-proof.", bold: true }, { text: " Receipts are signed by a hardware-backed key on the device and committed to a public timestamp; modifications are detectable, not prevented." }]),
  bulletRich([{ text: "Verifiable without WorkProof.", bold: true }, { text: " Anyone with the receipt can verify the signature and the timestamp using public tooling. Our server is a convenience, not a root of trust." }]),
  bulletRich([{ text: "Worker-owned.", bold: true }, { text: " The worker keeps their key and their receipts. Employers and payers receive copies, not custody." }]),
  bulletRich([{ text: "Cheap to produce, cheap to verify.", bold: true }, { text: " A receipt is small, a verification is a few signature checks plus one HTTP fetch." }]),

  H2("2.3 The value, in one sentence"),
  P("A WorkProof receipt converts a contested he-said-she-said into a one-click “this really happened, here, at this time, by this person, and the proof is independent of any platform.”"),
];

// =============================================================================
// 3. ARCHITECTURE
// =============================================================================
const archChildren = [
  H1("3. Architecture"),
  P("WorkProof is split into three layers: the worker’s device (the “proof producer”), an opportunistic sync service (the “notary backbone”), and a verifier surface (“anyone with a link”). Each layer can fail without compromising the integrity of receipts that have already been produced.", { after: 160 }),

  H2("3.1 Layer 1 — Device (proof producer)"),
  bullet("React Native app with a local SQLite store and an encrypted media cache."),
  bullet("Hardware-backed signing key (iOS Secure Enclave / Android StrongBox) bound to the worker identity."),
  bullet("Capture pipeline: camera, microphone, GNSS, barometer, accelerometer, network state."),
  bullet("Deterministic canonicalization: every receipt is serialized to a canonical byte form before signing so the signature is reproducible by any verifier."),
  bullet("Outbox: receipts and evidence wait in a durable queue until the device sees a usable network."),

  H2("3.2 Layer 2 — Sync service (notary backbone)"),
  bullet("Stateless API in front of object storage for evidence blobs and a small database for receipt headers."),
  bullet("Public timestamp service integration: each receipt header is anchored via RFC 3161 and OpenTimestamps once it arrives. The anchor is attached back to the receipt."),
  bullet("Issuer key registry: maps worker identity to its current device public key, with a signed history so rotations are auditable."),
  bullet("Webhooks/email out for the payer (“your technician completed the job, here is the receipt”)."),

  H2("3.3 Layer 3 — Verifier (anyone)"),
  bullet("Public web page at a stable URL: paste a receipt or scan a QR code, see the verification result."),
  bullet("CLI/SDK for back-office systems that want to verify in bulk."),
  bullet("Verification is local: the verifier checks the signature against the registered issuer key and checks the timestamp anchor against the public timestamping authority. WorkProof is not in the trust path."),
];

// =============================================================================
// 4. COMPONENTS TABLE
// =============================================================================
const componentsTableWidths = [2200, 4360, 2800];
const componentsRows = [
  ["Mobile app", "Capture, sign, store, queue, sync receipts. Offline-first.", "React Native, SQLite, Expo SecureStore, native crypto modules"],
  ["Hardware key", "Per-device signing key bound to worker identity; non-exportable.", "iOS Secure Enclave, Android StrongBox / Keystore"],
  ["Canonicalizer", "Stable byte form for receipts so signatures are reproducible.", "JSON Canonicalization Scheme (RFC 8785)"],
  ["Outbox", "Durable queue of pending receipts and media blobs.", "SQLite + filesystem, retry with backoff"],
  ["Sync API", "Receives receipts, stores evidence, returns timestamp anchors.", "Node.js, S3-compatible storage, Postgres"],
  ["Timestamp", "Independent proof that a receipt existed at a point in time.", "RFC 3161 TSA, OpenTimestamps (Bitcoin)"],
  ["Key registry", "Maps worker identity to device public key, with signed history.", "Postgres, append-only audit table"],
  ["Verifier web", "Public page that verifies a receipt without trusting WorkProof.", "Static site, WebCrypto, OTS verifier"],
  ["Verifier SDK", "Back-office verification for payers and platforms.", "TypeScript and Python libraries"],
];
const componentsTable = makeTable(componentsTableWidths, ["Component", "Responsibility", "Tech"], componentsRows);

const componentsChildren = [
  H1("4. Components"),
  P("Each row is a unit of code with a single responsibility. The boundary between layers is intentional: the mobile app is the only thing that holds signing keys, and the verifier is the only thing the payer has to run.", { after: 160 }),
  componentsTable,
];

// =============================================================================
// 5. END-TO-END FLOW
// =============================================================================
const flowChildren = [
  H1("5. End-to-End Flow"),
  P("The happy path, step by step. Each step is independent: a failure in step N never invalidates the work captured in step N−1.", { after: 140 }),

  H3("Step 1 — Worker arrives on site"),
  bullet("Worker opens WorkProof and taps Start. The app records start time, GNSS fix with accuracy, network state, and (if available) barometric altitude."),
  bullet("If the job has a known address or geofence, the app notes whether the start fix is inside the geofence."),

  H3("Step 2 — Worker captures evidence"),
  bullet("Photos and short audio are captured through the WorkProof camera/recorder. Each frame is hashed at capture; the hash is included in the receipt."),
  bullet("Optional checklist items are ticked. Free-text notes are typed."),
  bullet("All media is stored locally, encrypted at rest. Nothing leaves the device yet."),

  H3("Step 3 — Worker taps Done"),
  bullet("App assembles a draft receipt: who (worker id + device key), what (job + checklist + media hashes), where (start/end fix), when (start/end device time)."),
  bullet("Receipt is canonicalized and signed by the hardware-backed key. The signed receipt is appended to the outbox along with the encrypted media."),
  bullet("Worker sees a receipt ID and a local QR. They are now free to drive away — no network needed."),

  H3("Step 4 — Sync (whenever connectivity returns)"),
  bullet("Outbox drains in the background. Receipts headers go to the API; media blobs go to object storage by content hash."),
  bullet("Server requests a public timestamp anchor (RFC 3161 immediately, OpenTimestamps in the next aggregation window) for the receipt header and stitches the anchor back into the receipt."),
  bullet("Server emits a webhook to the payer with a verification link."),

  H3("Step 5 — Verification (anyone, anytime)"),
  bullet("Payer opens the link or scans the QR. The verifier page fetches the receipt, the public key from the registry, and the timestamp anchor."),
  bullet("Verifier locally checks: signature matches public key, public key was registered to that worker identity at the receipt’s claimed time, timestamp anchor is valid."),
  bullet("If all three hold, the page renders a green check and a human-readable summary. If any fail, it renders a precise reason."),
];

// =============================================================================
// 6. DATA MODEL
// =============================================================================
const dataModelChildren = [
  H1("6. Data Model"),
  P("The receipt is the unit of truth. Everything else (jobs, workers, payers) is convenience metadata around it.", { after: 140 }),

  H2("6.1 Receipt (canonical JSON, abbreviated)"),
  code(`{`),
  code(`  "v": 1,`),
  code(`  "id": "wp_01HXY...",            // ULID, set on device`),
  code(`  "worker": {`),
  code(`    "id": "wkr_01HX...",           // stable worker identity`),
  code(`    "key_id": "k_01HX...",         // device public key id`),
  code(`    "key_alg": "ES256"             // P-256 ECDSA, hardware-backed`),
  code(`  },`),
  code(`  "job": {`),
  code(`    "ref": "JOB-2026-00471",       // optional external ref`),
  code(`    "title": "Replace condenser fan motor",`),
  code(`    "checklist": [`),
  code(`      {"item": "shutoff verified", "ok": true},`),
  code(`      {"item": "voltage tested",   "ok": true}`),
  code(`    ],`),
  code(`    "notes": "Bearing seized; replaced under warranty."`),
  code(`  },`),
  code(`  "where": {`),
  code(`    "start": {"lat": 40.7128, "lon": -74.0060, "acc_m": 4.2, "alt_m": 11.0},`),
  code(`    "end":   {"lat": 40.7128, "lon": -74.0061, "acc_m": 5.1},`),
  code(`    "geofence_ref": "gf_acmehq",   // optional, anchors a known site`),
  code(`    "inside_geofence": true`),
  code(`  },`),
  code(`  "when": {`),
  code(`    "start_local": "2026-06-18T09:14:32-04:00",`),
  code(`    "end_local":   "2026-06-18T10:02:11-04:00",`),
  code(`    "device_tz":   "America/New_York"`),
  code(`  },`),
  code(`  "evidence": [`),
  code(`    {"kind":"photo","sha256":"3f9c...","bytes":2841120,"taken_at":"...09:21:04-04:00"},`),
  code(`    {"kind":"audio","sha256":"a13e...","bytes":  98432,"taken_at":"...09:34:48-04:00"}`),
  code(`  ],`),
  code(`  "device": {`),
  code(`    "platform": "ios",`),
  code(`    "model":    "iPhone 15",`),
  code(`    "os":       "iOS 19.2",`),
  code(`    "app":      "workproof/1.0.0"`),
  code(`  },`),
  code(`  "sig":  "...base64...",          // signature over canonical bytes`),
  code(`  "anchor": {                       // attached on first sync`),
  code(`    "rfc3161": "...base64-tsr...",`),
  code(`    "ots":     "...base64-ots..."`),
  code(`  }`),
  code(`}`),

  H2("6.2 Storage tables (server-side)"),
  bulletRich([{ text: "receipts", code: true }, { text: " — receipt header + signature + anchor; immutable once written." }]),
  bulletRich([{ text: "evidence_blobs", code: true }, { text: " — content-addressed (sha256) media in object storage; one row per upload." }]),
  bulletRich([{ text: "workers", code: true }, { text: " — identity, contact, employer, current key id." }]),
  bulletRich([{ text: "keys", code: true }, { text: " — public key history per worker, each row signed by the previous key (rotations are auditable)." }]),
  bulletRich([{ text: "geofences", code: true }, { text: " — named site polygons or radii." }]),
  bulletRich([{ text: "webhooks", code: true }, { text: " — payer notification configs and delivery log." }]),
];

// =============================================================================
// 7. VERIFIABILITY TABLE
// =============================================================================
const verifTableWidths = [2400, 3500, 3460];
const verifRows = [
  ["Identity (who)", "Signature on the receipt was made by the worker’s registered hardware-backed key.", "ECDSA verify against the registry; rejected if the key was not registered to that worker at the receipt time."],
  ["Content (what)", "Job description, checklist, notes, and media hashes match what was signed.", "Recompute hash of canonical receipt; recompute sha256 of each fetched media blob; compare to receipt."],
  ["Place (where)", "GNSS fix and (optional) geofence membership were recorded at capture time.", "Inspect the fix and accuracy; for a known site, check inside_geofence and the geofence definition. Trust is bounded by GNSS accuracy."],
  ["Time (when)", "Receipt existed at or before a public point in time.", "RFC 3161 TSR validates against the TSA cert chain; OpenTimestamps anchor validates against Bitcoin block headers."],
  ["Tamper-evidence", "Any modification to receipt content invalidates the signature.", "Standard signature verification; one bit flipped breaks verification."],
  ["Issuer revocation", "If a device or worker key is revoked, receipts before revocation still verify.", "Registry stores key validity intervals; verification uses the receipt’s claimed time, not “now.”"],
];
const verifTable = makeTable(verifTableWidths, ["Claim", "What is verified", "How"], verifRows);

const verifChildren = [
  H1("7. Verifiability"),
  P("Verification is the product. Every claim a WorkProof receipt makes maps to a check that any third party can perform with public tooling.", { after: 140 }),
  verifTable,
  P(""),
  P("Important: WorkProof does not claim the receipt is true. It claims that a specific worker, on a specific device, asserted these facts at a specific time, and that no one has modified the assertion since. The strength of any individual claim (especially location) is bounded by the device’s sensors. Receipts always carry their own confidence.", { italics: true, color: PEGGY_GRAY }),
];

// =============================================================================
// 8. OFFLINE / ONLINE
// =============================================================================
const oolTableWidths = [2200, 3580, 3580];
const oolRows = [
  ["Capture receipt", "Full functionality. Receipt is signed locally; ID returned to user.", "Full functionality, identical code path."],
  ["Capture media", "Photos/audio stored encrypted on device.", "Same; uploaded later."],
  ["GNSS fix", "Recorded if GPS is available (does not need cellular).", "Same."],
  ["Sign receipt", "Done in hardware on-device; no network needed.", "Same."],
  ["Public timestamp", "Deferred; receipt is marked anchor: pending.", "Anchor is requested and stitched in within seconds (RFC 3161) or on the next aggregation (OTS)."],
  ["Notify payer", "Deferred until sync.", "Webhook/email fires immediately."],
  ["Verify a receipt", "Verifier needs network to fetch the public key and timestamp authority— but cached registries and offline anchors work.", "Standard verification."],
  ["Conflict resolution", "Receipts are immutable once signed; later edits become new receipts referencing the prior id.", "Same."],
];
const oolTable = makeTable(oolTableWidths, ["Concern", "Offline behavior", "Online behavior"], oolRows);

const oolChildren = [
  H1("8. Offline and Online"),
  P("WorkProof treats connectivity as a luxury, not a precondition. Below is the behavior matrix that the app and the server both honor.", { after: 140 }),
  oolTable,
];

// =============================================================================
// 9. IN / OUT OF SCOPE
// =============================================================================
const scopeChildren = [
  H1("9. In and Out of Scope"),

  H2("9.1 In scope (v1)"),
  bullet("Mobile app for iOS and Android with full offline capture and signing."),
  bullet("Hardware-backed device keys, key registry, and signed key rotation history."),
  bullet("Canonical JSON receipts with embedded media hashes."),
  bullet("RFC 3161 timestamping and OpenTimestamps anchoring."),
  bullet("Public verifier web page and TypeScript/Python verifier SDK."),
  bullet("Webhook + email delivery to a payer of record."),
  bullet("Single-tenant deployment for a pilot customer."),

  H2("9.2 Out of scope (v1)"),
  bullet("Payment processing, invoicing, or settlement. WorkProof produces evidence; payment systems consume it."),
  bullet("Dispatch, routing, and workforce management. We integrate; we do not replace these tools."),
  bullet("CRM features (customer history, marketing, sales pipeline)."),
  bullet("Photo/audio analysis (object detection, transcription) beyond hash and timestamp."),
  bullet("Cross-organization identity federation. v1 binds a worker identity to a single issuing employer or self-employed account."),
  bullet("Multi-tenant SaaS billing, role-based access for large fleets, full admin console."),
  bullet("Legal admissibility certifications in any specific jurisdiction. Receipts are designed to be admissible-grade evidence; we do not certify per-jurisdiction outcomes in v1."),
];

// =============================================================================
// 10. FUTURE ENHANCEMENTS
// =============================================================================
const futureChildren = [
  H1("10. Future Enhancements"),

  H3("10.1 Stronger location proofs"),
  bullet("Multi-source location (GNSS + Wi-Fi RTT + BLE beacons + cell tower triangulation), each with their own signed sub-receipt and accuracy."),
  bullet("Geofence-anchored “station receipts” where a known site’s BLE beacon co-signs the receipt."),
  bullet("Photogrammetric place-of-work proofs (camera-derived match against a known site’s reference image)."),

  H3("10.2 Stronger time proofs"),
  bullet("Multiple independent TSAs per receipt (defense in depth)."),
  bullet("Optional opportunistic peer-to-peer attestation: a second device on site countersigns the receipt."),

  H3("10.3 Worker and team experience"),
  bullet("Voice-only capture flow for hands-busy work."),
  bullet("Auto-checklist suggestions based on job type."),
  bullet("Apple Watch / Wear OS quick-capture."),
  bullet("Team mode: foreman issues a receipt that includes signed sub-receipts from each crew member."),

  H3("10.4 Payer integrations"),
  bullet("Native ServiceTitan, Housecall Pro, FieldEdge, Salesforce Field Service plugins."),
  bullet("Insurance and warranty integrations: receipts attached automatically to a claim."),
  bullet("Marketplace integrations (Thumbtack, Angi) so disputes resolve faster."),

  H3("10.5 Worker-facing utility"),
  bullet("Personal portfolio: a worker can publish a verifiable history of completed work for marketing and reputation, without exposing customer data."),
  bullet("Earnings analytics derived from receipts (hours, miles, dispute rate)."),

  H3("10.6 Platform"),
  bullet("Bring-your-own-storage for enterprises with data residency requirements."),
  bullet("Multi-tenant deployment, SSO, role-based access, audit logs."),
  bullet("Receipt schema v2 with structured material/parts and pricing for direct invoice generation."),
  bullet("Open-spec receipt format so other tools can issue WorkProof-compatible receipts."),
];

// =============================================================================
// FOOTER
// =============================================================================
const pageFooter = new Footer({
  children: [
    new Paragraph({
      tabStops: [
        { type: TabStopType.CENTER, position: Math.floor(CONTENT_WIDTH / 2) },
        { type: TabStopType.RIGHT, position: CONTENT_WIDTH },
      ],
      children: [
        new TextRun({ text: "WorkProof  ·  Technical Document", color: PEGGY_GRAY, size: 18 }),
        new TextRun({ text: "\t" }),
        new TextRun({ text: "Page ", color: PEGGY_GRAY, size: 18 }),
        new TextRun({ children: [PageNumber.CURRENT], color: PEGGY_GRAY, size: 18 }),
        new TextRun({ text: " of ", color: PEGGY_GRAY, size: 18 }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], color: PEGGY_GRAY, size: 18 }),
        new TextRun({ text: "\t" }),
        new TextRun({ text: "v1.0", color: PEGGY_GRAY, size: 18 }),
      ],
    }),
  ],
});

// First-page footer (cover) - blank
const coverFooter = new Footer({
  children: [new Paragraph({ children: [new TextRun({ text: "" })] })],
});

// =============================================================================
// DOCUMENT
// =============================================================================
const doc = new Document({
  creator: "WorkProof",
  title: "WorkProof Technical Document",
  description: "Receipts for the work that doesn't show up.",
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22, color: PEGGY_INK } },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: PEGGY_INK },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: PEGGY_INK },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: PEGGY_INK },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ],
      },
    ],
  },
  sections: [
    // Section 1: Cover (no footer)
    {
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
        titlePage: true,
      },
      footers: { default: coverFooter, first: coverFooter },
      children: coverChildren,
    },
    // Section 2: TOC + body (with page numbers)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          pageNumbers: { start: 1 },
        },
      },
      footers: { default: pageFooter },
      children: [
        ...tocChildren,
        ...problemChildren,
        ...solutionChildren,
        ...archChildren,
        ...componentsChildren,
        ...flowChildren,
        ...dataModelChildren,
        ...verifChildren,
        ...oolChildren,
        ...scopeChildren,
        ...futureChildren,
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUT_PATH, buffer);
  console.log("Wrote", OUT_PATH, "(", buffer.length, "bytes )");
}).catch(err => {
  console.error("FAILED:", err);
  process.exit(1);
});
