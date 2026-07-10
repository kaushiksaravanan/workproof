#!/usr/bin/env node
/**
 * Interactive-adjacent deploy helper for WorkProofAnchor on Polygon Amoy.
 *
 * Usage:
 *   node contracts/deploy-helper.mjs             — generate a fresh wallet
 *   PRIVATE_KEY=0x... node contracts/deploy-helper.mjs — check balance + deploy
 *
 * Steps 1 & 2 are one-time; step 3 uses the same wallet each redeploy.
 */

import { JsonRpcProvider, Wallet, formatEther } from "ethers";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RPC = "https://rpc-amoy.polygon.technology";
const FAUCET = "https://faucet.polygon.technology";
const MIN_MATIC = 0.02; // creation gas is small; 0.02 leaves headroom

async function main() {
  const key = process.env.PRIVATE_KEY;

  if (!key) {
    console.log("\n=== Step 1: Generate a deploy wallet ===\n");
    const w = Wallet.createRandom();
    console.log(`Wallet address:  ${w.address}`);
    console.log(`Wallet key:      ${w.privateKey}\n`);
    console.log("SAVE THE PRIVATE KEY SECURELY. You'll pass it back via the");
    console.log("PRIVATE_KEY env var to complete the deploy.\n");
    console.log("=== Step 2: Fund the wallet on Polygon Amoy testnet ===\n");
    console.log(`  1. Visit ${FAUCET}`);
    console.log(`  2. Paste the address above: ${w.address}`);
    console.log(`  3. Solve the captcha / sign in — request ~0.05 test MATIC.`);
    console.log(`  4. Wait ~30s for the tx to confirm.\n`);
    console.log("=== Step 3: Re-run this script with PRIVATE_KEY set ===\n");
    console.log(`  PRIVATE_KEY=${w.privateKey} node contracts/deploy-helper.mjs\n`);
    process.exit(0);
  }

  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(key, provider);
  console.log(`\nWallet:  ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  const balMatic = Number(formatEther(balance));
  console.log(`Balance: ${balMatic.toFixed(4)} MATIC\n`);

  if (balMatic < MIN_MATIC) {
    console.error(
      `Insufficient balance. Need at least ${MIN_MATIC} MATIC to deploy safely.`,
    );
    console.error(`Fund the wallet at ${FAUCET} and re-run.\n`);
    process.exit(1);
  }

  console.log("Balance OK. Deploying WorkProofAnchor...\n");

  // Delegate to the existing deploy.ts (contains committed bytecode).
  const here = dirname(fileURLToPath(import.meta.url));
  const deployTs = join(here, "deploy.ts");
  const child = spawn(
    "npx",
    ["ts-node", "--esm=false", deployTs],
    {
      env: { ...process.env, PRIVATE_KEY: key },
      stdio: "inherit",
      shell: true,
    },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
