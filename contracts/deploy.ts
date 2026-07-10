/**
 * Deployment script for WorkProofAnchor on Polygon Amoy testnet.
 *
 * This file is COMMITTED but NOT RUN as part of the app build. It is intended
 * to be invoked manually by an operator with a funded Amoy private key, e.g.:
 *
 *   PRIVATE_KEY=0xabc... npx ts-node contracts/deploy.ts
 *
 * After compiling WorkProofAnchor.sol with solc 0.8.24 (via foundry or
 * hardhat), paste the resulting ABI and bytecode into the constants below.
 */

import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";

import { POLYGON_AMOY_RPC } from "../app/src/services/config";

// ABI for WorkProofAnchor. This is deterministic from the .sol source — one
// event, one function — so it's pre-populated here so the operator only
// needs to paste bytecode after compile.
const ABI: ReadonlyArray<unknown> = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "hash", type: "bytes32" },
      { indexed: true, internalType: "address", name: "worker", type: "address" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "Anchored",
    type: "event",
  },
  {
    inputs: [{ internalType: "bytes32", name: "hash", type: "bytes32" }],
    name: "anchor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// TODO: paste-after-compile — replace with the bytecode (creation code, with
// the leading "0x") emitted by the compiler.
const BYTECODE: string = "0x";

async function main(): Promise<void> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "PRIVATE_KEY env var is required (Amoy-funded EOA private key)."
    );
  }

  if (BYTECODE === "0x") {
    throw new Error(
      "BYTECODE is a placeholder — compile WorkProofAnchor.sol (solc 0.8.24) and paste the creation bytecode in before running."
    );
  }

  const provider = new JsonRpcProvider(POLYGON_AMOY_RPC);
  const wallet = new Wallet(privateKey, provider);

  console.log(`Deploying WorkProofAnchor from ${wallet.address}...`);

  const factory = new ContractFactory(ABI, BYTECODE, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`WorkProofAnchor deployed at: ${address}`);
  console.log(
    `Set EXPO_PUBLIC_ANCHOR_ADDRESS=${address} in the app environment.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
