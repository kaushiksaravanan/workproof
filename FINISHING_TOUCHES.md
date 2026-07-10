# Finishing Touches — User-Only Actions

Everything else in the project is done. These three items require access
this session doesn't have. Each is copy-paste from here.

## 1. Enable GitHub Actions CI

The CI workflow at `docs/proposed-ci-workflow.yml` is compile-ready but
lives outside `.github/workflows/` because pushing to that path needs
the `workflow` OAuth scope on your gh token. Grant it once, then move:

```bash
gh auth refresh -h github.com -s workflow
mkdir -p .github/workflows
mv docs/proposed-ci-workflow.yml .github/workflows/ci.yml
git add -A && git commit -m "Enable CI"
git push origin master
```

After the push, every commit to master and every PR runs
`npm run verify` (tsc --noEmit + jest --ci --runInBand). Locally the
same command already reproduces the CI signal.

## 2. Deploy WorkProofAnchor to Polygon Amoy

Two-command flow using the helper script — generates a wallet, prompts
you to fund it, then deploys.

```bash
cd contracts
node deploy-helper.mjs                       # step 1: prints wallet
# — fund the printed address at https://faucet.polygon.technology —
PRIVATE_KEY=0x... node deploy-helper.mjs     # step 2: deploys
```

The helper prints the deployed contract address on success. Set that as
`EXPO_PUBLIC_ANCHOR_ADDRESS` in `app/.env` for local dev and in the
Vercel project's env vars for the web build. Without this, the app
still runs — anchor calls just queue locally with `queued:<hash>`
synthetic tx ids until you flush them.

ABI + creation bytecode are already committed to `contracts/deploy.ts`
(solc 0.8.24, optimizer runs=200). No solc install required.

## 3. Redeploy Vercel

The `workproof-demo.vercel.app` alias is on a Vercel team that this
session doesn't have access to. Two ways to redeploy the latest code:

**Via the Vercel dashboard (easiest):**
1. Open the project on vercel.com.
2. Click Deployments → the latest master commit → Redeploy.

**Via CLI (if you're logged into the right team):**
```bash
cd app
vercel deploy --prod --yes
```

Alternatively, connect the GitHub repo's git integration under Vercel's
project settings — any push to master will auto-deploy going forward.

## 4. Optional: Upstash Redis for cross-instance rate limiting

`/api/vend` has a two-tier limiter — always-on in-memory per warm
instance, plus optional cross-instance via Upstash REST. Zero SDK
needed; just set env vars on the Vercel project:

```
UPSTASH_REDIS_URL=https://<your-instance>.upstash.io
UPSTASH_REDIS_TOKEN=<REST token>
```

Free Upstash tier is more than enough for hackathon-day traffic. The
in-memory limiter remains authoritative on Upstash outage, so a Redis
blip doesn't 500 the endpoint. See `app/api/vend.ts:upstashRateCheck`.

## 5. Optional: Attestation on `/api/vend`

Current defenses: origin allow-list, per-IP rate limit (10/60s
in-memory + Upstash cross-instance if configured). Missing: device
attestation.

If you want to close the attacker-with-real-mobile-device gap:
- Native: Play Integrity API (Android) / DeviceCheck (iOS). Mint a
  short-lived signed token per install; `/api/vend` verifies before
  forwarding.
- Web: Cloudflare Turnstile / hCaptcha widget on the browser side.

Any of these need day-of hackathon SDK creds. The vend handler is
ready to gate on a header — add an `assertAttestation(req)` call
before the CipherStack forward.
