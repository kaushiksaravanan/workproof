# WorkProof — Mobile App

Expo / React Native client for capturing signed proof-of-work bundles in the field.

## Prerequisites

- **Node.js 20+** (`node --version` should print `v20.x` or higher). Use `nvm` / `volta` / `fnm` if you need to switch.
- **npm 10+** (ships with Node 20).
- **Android Studio** — only required if you want to run the Android emulator. For the QR-code path you can skip Studio entirely; a physical Android device with Expo Go is enough.
- **Expo Go** on your Android phone — install from the Play Store: <https://play.google.com/store/apps/details?id=host.exp.exponent>.
- **Same Wi-Fi network** for the laptop and the phone (Expo's QR pairing uses LAN by default).

iOS is buildable from the same source on a Mac, but the demo path below assumes Android + Expo Go because that's what the crew uses.

## Install & run

```bash
cd app
npm install
npx expo start
```

`npx expo start` opens the Metro bundler in your terminal and prints a QR code.

1. Unlock your Android phone.
2. Open **Expo Go**.
3. Tap **Scan QR code** and point it at the terminal.
4. The bundle downloads (~10–20s on first run); WorkProof opens.

If LAN pairing flakes (corporate Wi-Fi, VPN, hotspot weirdness), press `s` in the Expo CLI to switch to **Tunnel** mode. Slower, but works through any network.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm run start` | Same as `npx expo start`. |
| `npm run android` | Boots the bundler and tries to launch an Android emulator / connected device. |
| `npm run ios` | macOS only — opens the iOS simulator. |
| `npm run web` | Renders in a browser tab. Camera and audio paths are limited; use for layout work only. |

## Android permissions

The app requests, at runtime, the following permissions. Grant them when Android prompts — denying any of them blocks the corresponding step of the demo.

- **Camera** — capture the photo of the finished work. Configured via `expo-camera` in `app.json`.
- **Microphone** — record the voice memo. Requested by both `expo-camera` (video mode) and `expo-av` (audio recording). Declared in `app.json` under both plugins.
- **Storage / Media** (Android 12 and below) — write the exported PDF. On Android 13+ this is replaced by scoped sharing via the system share sheet, no permission dialog.

If you accidentally tap "Deny", clear permissions in **Settings → Apps → Expo Go → Permissions**, then reopen the app. WorkProof itself doesn't appear in the apps list during dev — it lives inside Expo Go.

## Environment variables

The mobile app does not require any environment variables to run the demo. Everything is on-device.

For LLM-backed field extraction (`services/llm.ts`), the app can vend Gemini keys from CipherStack. Copy `.env.example` to `.env` and fill in:

```bash
EXPO_PUBLIC_CIPHERSTACK_TOKEN=csk_your_service_token_here
EXPO_PUBLIC_HACKATHON_KEY=0xabcdef...           # any hex private key for signing
EXPO_PUBLIC_ANCHOR_ADDRESS=0x0000...            # Polygon Amoy anchor contract
```

`EXPO_PUBLIC_*` is the only prefix Expo exposes to the client at build time. Anything without that prefix is invisible to the running app — that's intentional.

**Native-bundle caveat.** `EXPO_PUBLIC_*` values are inlined into the shipped bundle and are extractable from the APK. For production, put long-lived secrets behind a server-side proxy (see the Vercel section below for the pattern).

## Deploying the web build to Vercel

The Expo web export renders in a browser (Home / History / ProofDetail / Onboarding). Camera / mic / file-system paths are no-ops on web, so LogWork mounts but the record button does nothing.

### One-time setup

```bash
cd app
npx expo install react-native-web react-dom @expo/metro-runtime
```

`vercel.json` is committed and points at `npx expo export --platform web` with output in `dist/`.

### Deploy

From the repo root (not `app/` — the project's `rootDirectory` is set to `app` on Vercel):

```bash
vercel deploy --prod --scope <your-team>
```

Set the following env vars on the Vercel project. **Do not use the `EXPO_PUBLIC_` prefix for secrets** — those get inlined into the browser bundle.

| Var | Scope | Purpose |
| --- | --- | --- |
| `CIPHERSTACK_TOKEN` | server-only (production/preview/development) | Read by `/api/vend` to forward vend calls without leaking the token to the client. |

### The `/api/vend` proxy

`app/api/vend.ts` is a Vercel serverless function that:

- Reads `process.env.CIPHERSTACK_TOKEN` server-side (never inlined into the bundle).
- Accepts `GET /api/vend?group=<slug>`.
- Allow-lists 10 CipherStack groups: `gemini`, `openrouter`, `huggingface`, `mistral`, `groq`, `nvidia`, `cerebras`, `cohere`, `github-models`, `cloudflare-ai`.
- Forwards to `https://cipherstack.kaushik.cv/api/v1/vend/<group>` with the bearer token and passes the response through.

On web, `vendGeminiKey()` calls `/api/vend?group=gemini` (same-origin, no Authorization header). On native, it hits CipherStack directly using the bundled `EXPO_PUBLIC_CIPHERSTACK_TOKEN` (accepted APK-extractable exposure).

Tested at `api/__tests__/vend.test.ts` — 11 cases covering missing group, invalid group, missing env var, non-GET/HEAD 405, HEAD 200, bearer-header forwarding, upstream status pass-through, non-JSON upstream, network failure, and array-valued query params.

### Expo Go SDK compatibility

If you also want to preview the app in Expo Go on a phone, the installed Expo Go version must match the app's Expo SDK. Currently SDK 54. If Expo Go shows "incompatible SDK version", update it from the Play Store.

## Demo path (90 seconds)

This is the tour you give a stakeholder. It hits every primitive without dwelling.

1. **0:00 — Open the app.** Cold-start lands on the home screen with the marker-underline title and the "New proof" CTA. Mention the brand: paper, ink, Fraunces + Plus Jakarta Sans.
2. **0:10 — Tap "New proof".** The capture screen takes over. Camera preview is live.
3. **0:15 — Take the photo.** Big shutter. One tap. Photo locks into the bundle and the screen flips to the voice-memo step.
4. **0:25 — Record the voice memo.** Hold-to-record. Say something like "Replaced the kitchen sink trap, ran water for two minutes, no leaks." Release to stop. The waveform settles.
5. **0:40 — Watch the transcription.** `TranscriptScreen` shows the recognized text on the notebook-paper surface. Edit inline if needed — the crew often fixes a job number or a customer name here.
6. **0:55 — Sign the bundle.** Tap "Sign & seal". Under the hood, `expo-crypto` hashes the canonical record (fields + photo hash + audio hash + timestamp) and signs the digest with the device key. The screen shows the short fingerprint.
7. **1:10 — Export the PDF.** `expo-print` renders a one-pager with the photo, transcript, location, signature, and a QR pointing at the verifier. Tap **Share**.
8. **1:25 — Send via WhatsApp / email.** The native share sheet opens. Pick a contact. The PDF lands on the homeowner's phone within seconds.
9. **1:30 — Done.** Close the loop: "That's the artifact. Anyone with the PDF can re-verify the signature later — the crew never had to leave Expo Go."

If you have an extra 30 seconds, scroll back through previous proofs on the home screen and open one to show the immutable detail view.

## Troubleshooting

**`Unable to resolve module ...` after `npm install`.**
Stop the bundler, then `rm -rf node_modules .expo && npm install && npx expo start --clear`. Metro caches aggressively; `--clear` is the fix 80% of the time.

**QR code scans but the app never loads ("Network response timed out").**
Your laptop and phone are on different subnets, or your Wi-Fi has client isolation. Press `s` in the Expo CLI to switch to Tunnel mode. As a fallback, plug the phone in over USB, run `adb reverse tcp:8081 tcp:8081`, and use **Enter URL manually → `exp://localhost:8081`** in Expo Go.

**`Error: EMFILE: too many open files, watch`.**
Metro's file watcher hit the OS limit. On macOS/Linux: `ulimit -n 4096`. On Windows: usually fine; close other watchers (VS Code's TypeScript server, Docker Desktop) and retry.

**Camera preview is black.**
You denied the camera permission. Settings → Apps → Expo Go → Permissions → Camera → Allow. Then fully close and reopen Expo Go (not just the WorkProof view).

**`Invariant Violation: "main" has not been registered`.**
You're on a Node version Expo doesn't support. Confirm with `node --version`. Anything below 20 will misbehave with Expo SDK 54.

**`expo-av` warns about deprecation.**
Known. SDK 54 ships `expo-av` alongside the new `expo-audio`; we'll migrate after the demo. Safe to ignore.

**Expo Go says "This project requires a newer version of Expo Go".**
Update Expo Go from the Play Store. If the store says it's already current, your Expo Go is pinned to an older SDK — uninstall and reinstall.

**Fonts render as system default for a beat.**
First boot only. `@expo-google-fonts/fraunces` and `@expo-google-fonts/plus-jakarta-sans` cache after the first load. The font-loading splash announces via `AccessibilityInfo` so screen-reader users aren't surprised.

**`adb` not found when using `npm run android`.**
Install Android Studio's Platform Tools and add `platform-tools` to `PATH`. Or skip the emulator path entirely and use Expo Go on a real device — that's the supported demo flow.

**TypeScript errors on a fresh clone.**
Run `npx tsc --noEmit`. Strict mode is on; the tree should be clean. If it isn't, you've pulled mid-change — `git status` and rebase.

**Anything else.**
Run with `npx expo start --clear` first. If it persists, capture the full Metro log and the device's Expo Go logs (shake the phone → **Debug** → **Open JS Debugger**) before filing.
