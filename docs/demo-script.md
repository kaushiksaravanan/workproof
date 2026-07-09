# WorkProof — Demo Script

## Elevator Pitch (3 lines)

WorkProof turns a 30-second site walkthrough into a tamper-evident record: photo + voice + location + timestamp, signed on-device, exported as a shareable PDF.
A homeowner can verify the proof on the spot from a WhatsApp message; a crew can prove the work weeks later without hunting for photos.
No app store login, no cloud upload — the artifact lives on the crew's phone and travels through whatever channel they already use.

## 30-Second Short Version

"Contractors and crews already take job photos on their phones — but the photos scatter across camera rolls, WhatsApp threads, and lost text messages. WorkProof captures the photo, voice memo, and job details in one 30-second flow, signs the whole bundle with a device key, and exports a one-page PDF that anyone can verify later. The voice memo attaches to the record; the crew types (or edits) a short transcript in the same screen; an optional Gemini extraction fills work type, client, and amounts from that text. On-chain anchoring gives the artifact a permanent timestamp. Demo runs in 90 seconds on any Android phone with Expo Go."

## 90-Second Demo Script

| Time | What user does (on-stage) | What to say | Risk + fallback |
|---|---|---|---|
| 0:00–0:10 | Open the app on the phone (Expo Go). Home screen shows the marker-underline "Today" title and stat cards. | "This is WorkProof. Peggy design system — paper, ink, Fraunces + Plus Jakarta Sans. Home shows jobs this week and how many are anchored on-chain." | If Expo Go says "incompatible SDK", update from Play Store — SDK 54 is required. Backup: the web build at workproof-demo.vercel.app renders the same UI. |
| 0:10–0:15 | Tap "Log today's work". | "New proof." | Sheet gesture flake — if the sheet doesn't slide up, tap again. |
| 0:15–0:25 | Capture screen takes over. Camera preview is live. Tap the big shutter once. | "Photo locks into the bundle." | Camera permission — grant on first prompt; if denied, Settings → Apps → Expo Go → Permissions → Camera. |
| 0:25–0:40 | Hold the record button. Say "Replaced the kitchen sink trap for Sharma, ran water for two minutes, no leaks." Release. | "Voice memo attaches to the bundle. The next screen is the editable transcript." | Mic permission — same fallback as camera. |
| 0:40–0:50 | Type or paste the short transcript (or tap Extract for the Gemini-assisted fill). Edit inline to fix a job number, customer name, or location. | "Editable transcript on notebook paper. The Extract button is optional — Gemini pulls fields from what you type." | If Gemini extract fails, the regex baseline still pulls known amount / work-type patterns. |
| 0:50–1:05 | Tap "Sign & seal". expo-crypto hashes the canonical bundle (record fields + photo hash + audio hash) and it's signed with a device key. Short fingerprint appears. | "Every proof gets a cryptographic hash. If it's anchored to Polygon Amoy — signals the on-chain badge — the tx hash is permanent." | If no anchor address is configured, the proof queues locally and the badge shows 'queued'. Flushes on next foreground. |
| 1:05–1:20 | Tap "Share proof PDF". expo-print renders a one-pager (photo + transcript + location + signature + verify QR). Native share sheet opens. | "One-page PDF. Photo, transcript, location, signature, verify QR." | PDF render is the slowest step (~1.5s). Narrate the value while it renders. |
| 1:20–1:30 | Pick a WhatsApp contact or email address. Watch the PDF land on the other device. | "That's the artifact. Anyone with the PDF can re-verify the signature later — the crew never had to leave Expo Go." | Share sheet needs a real contact — pre-pin one before the demo. |

If you have an extra 30 seconds, scroll back through History and open an anchored record to show the immutable detail view (with the `amoy.polygonscan.com` link).

## Pre-Demo Checklist

- Pre-warm: open the app once, complete Onboarding, capture one proof so History has content. Cold start hides the empty state you don't want to show.
- Update Expo Go from Play Store to match SDK 54.
- Grant Camera + Mic permissions in advance (Settings → Apps → Expo Go → Permissions).
- Disable notifications: Slack, WhatsApp, calendar, system updates.
- Display: mirror the phone via `scrcpy` or Vysor; portrait, 125% zoom on the projector output.
- Backup: keep the web build (`workproof-demo.vercel.app`) open in a tab. Camera/mic are no-ops on web but Home / History / ProofDetail all render; useful if the phone dies.
- Network: WiFi + phone hotspot as failover. Anchor step needs Polygon Amoy RPC reachable; offline gracefully queues.

## Recovery Lines (if something breaks)

- Capture fails (camera or mic): "That's a permission thing — one tap in Settings and we're back. In the meantime here's the web preview showing the same UI."
- Transcription empty: "The transcript is user-typed — I'll fill it in. The important part is the signature over the bundle, and the voice memo is attached as evidence anyway."
- Anchor fails / queued: "Amoy RPC has a hiccup — the proof is queued locally. When the phone reconnects it flushes automatically and the badge flips to anchored."
- Share sheet fails: "Pretend I sent it. The PDF is on the phone; it goes through WhatsApp, email, SMS, anything the crew already uses."
- App won't open in Expo Go: switch to the web build at workproof-demo.vercel.app — no camera/mic, but the Peggy UI renders and History/ProofDetail still work.
