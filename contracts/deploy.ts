/**
 * Deployment script for WorkProofAnchor on Polygon Amoy testnet.
 *
 * This file is COMMITTED but NOT RUN as part of the app build. It is intended
 * to be invoked manually by an operator with a funded Amoy private key:
 *
 *   PRIVATE_KEY=0xabc... npx ts-node contracts/deploy.ts
 *
 * ABI and bytecode below are both pre-compiled and committed — the operator
 * just needs a funded EOA. If you edit WorkProofAnchor.sol, re-generate the
 * bytecode with solc 0.8.24 and paste the result over BYTECODE below.
 */

import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";

import { POLYGON_AMOY_RPC } from "../app/src/services/config";

// ABI for WorkProofAnchor. Deterministic from the .sol source — one event,
// one function.
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

/**
 * Creation bytecode for WorkProofAnchor.sol.
 * Compiled with solc 0.8.24 (0.8.24+commit.e11b9ed9.Emscripten.clang),
 * optimizer enabled with 200 runs.
 *
 * Sanity check when editing: the trailing 0x33 in the runtime code is
 * PUSH1 33 (the CALLER opcode passed as `worker` to the Anchored event);
 * the metadata suffix (0xa2646970667358...) is the IPFS multihash of
 * the source that solc appends.
 */
const BYTECODE: string =
  "0x608060405234801561000f575f80fd5b5060c18061001c5f395ff3fe6080604052348015600e575f80fd5b50600436106026575f3560e01c8063eecdf92714602a575b5f80fd5b603960353660046075565b603b565b005b604051428152339082907ffe2289542f7a0110ac112c3a4d712afdcaaf2900a1326f4e6f340b563a0e87349060200160405180910390a350565b5f602082840312156084575f80fd5b503591905056fea264697066735822122005979794590cd927e9f4a55fd14caae336b74911981020165c89f4e6a024017764736f6c63430008180033";

async function main(): Promise<void> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "PRIVATE_KEY env var is required (Amoy-funded EOA private key)."
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
