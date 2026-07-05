/**
 * Application configuration constants.
 *
 * Secrets are read from EXPO_PUBLIC_* env vars, injected at build time by
 * Expo. See `.env.example` for the required variables. In a real production
 * deployment these should live behind a server-side proxy that vends
 * short-lived keys to the client — Expo public env vars end up in the
 * mobile bundle and are extractable from the APK.
 */

/** CipherStack service token used to vend Gemini keys. */
export const CIPHERSTACK_TOKEN = process.env.EXPO_PUBLIC_CIPHERSTACK_TOKEN;

/** CipherStack vend endpoint for the `gemini` group (auto-rotates LRU key). */
export const CIPHERSTACK_VEND_URL =
  "https://cipherstack.kaushik.cv/api/v1/vend/gemini";

/** Polygon Amoy testnet JSON-RPC endpoint. */
export const POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";

/** Polygon Amoy testnet chain id. */
export const POLYGON_AMOY_CHAIN_ID = 80002;

/** Hackathon demo signing key, injected at build time. Public-bundle caveat. */
export const HACKATHON_DEMO_KEY = process.env.EXPO_PUBLIC_HACKATHON_KEY;

/** Deployed anchor contract address on Polygon Amoy. */
export const ANCHOR_CONTRACT_ADDRESS = process.env.EXPO_PUBLIC_ANCHOR_ADDRESS;
