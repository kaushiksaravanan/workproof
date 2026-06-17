# WorkProof

Field-ready proof-of-work capture for crews and contractors. Snap a photo, record a voice note, and produce a signed, shareable PDF that a homeowner or PM can verify on the spot.

## What it does

WorkProof turns a 30-second site walkthrough into a tamper-evident record:

- **Photo + voice + GPS** captured in a single flow.
- **On-device transcription** turns the voice memo into a written report.
- **Cryptographic signing** (ethers.js) binds the bundle to a job key so the artifact can be re-verified later.
- **PDF export + share sheet** so the proof leaves the device through whatever channel the crew already uses (WhatsApp, email, SMS).

## Repository layout

```
workproof/
  app/             Expo / React Native client (the thing the crew runs)
  contracts/       Smart-contract scaffolding for on-chain anchoring
  docs/            Design docs, demo scripts, decision records
  _styleguide/     Brand assets, typography, color tokens, doodles
```

- `app/` is the only package you need to run for the demo. See `app/README.md` for prereqs and the 90s demo path.
- `contracts/` is optional and not exercised by the mobile demo.
- `docs/peggy-export/` and similar live notes inform the product copy.
- `_styleguide/` is where Fraunces + Plus Jakarta Sans, marker doodles, and the paper-and-ink palette are defined.

## Quickstart

```bash
git clone <this-repo>
cd workproof/app
npm install
npx expo start
```

Then open Expo Go on an Android phone, scan the QR code, and you're in. Full prereqs, permissions, env vars, and troubleshooting live in [`app/README.md`](app/README.md).

## Status

Demo-grade. The app boots, captures, signs, and exports end-to-end. Contracts and a hosted verifier are next.
