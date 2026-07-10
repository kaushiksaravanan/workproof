/**
 * Application configuration constants.
 *
 * Secrets are read from EXPO_PUBLIC_* env vars, injected at build time by
 * Expo. See `.env.example` for the required variables. In a real production
 * deployment these should live behind a server-side proxy that vends
 * short-lived keys to the client — Expo public env vars end up in the
 * mobile bundle and are extractable from the APK.
 */

/**
 * Base URL of the Vercel serverless deployment hosting /api/vend. Web
 * builds use the same-origin `/api/vend` and don't need this; native
 * builds (Expo Go / APK) hit the deployed URL directly.
 *
 * The CipherStack service token is NOT stored client-side — it lives in
 * the /api/vend proxy's server-only env. This closes the "extract the
 * token from the APK bundle" attack surface. See workproof task #31.
 */
export const API_VEND_BASE_URL =
  process.env.EXPO_PUBLIC_API_VEND_BASE_URL ??
  "https://workproof-demo.vercel.app";

/** Polygon Amoy testnet JSON-RPC endpoint. */
export const POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";

/** Polygon Amoy testnet chain id. */
export const POLYGON_AMOY_CHAIN_ID = 80002;

/** Deployed anchor contract address on Polygon Amoy. */
export const ANCHOR_CONTRACT_ADDRESS = process.env.EXPO_PUBLIC_ANCHOR_ADDRESS;
