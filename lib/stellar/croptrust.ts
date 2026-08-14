import {
  BASE_FEE,
  Contract,
  Horizon,
  rpc,
  TimeoutInfinite,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";

import {
  CONTRACT_IDS,
  STELLAR_HORIZON_URL,
  STELLAR_NETWORK_PASSPHRASE,
  STELLAR_RPC_URL,
} from "./config";

type ContractKey = keyof typeof CONTRACT_IDS;

export type MintCropInput = {
  farmer: string;
  cropType: string;
  quantityKg: number;
  priceXlm: string;
  harvestDate: string;
  parcelName: string;
  parcelBboxHash: string;
  parcelAreaHectares: number;
  region: string;
  minNdviBps: number;
  observationWindowDays: number;
};

export type BuyCropInput = {
  buyer: string;
  nftId: number;
};

export type ProofInput = {
  farmer: string;
  nftId: number;
  proofHash: string;
};

export type VerifyInput = {
  validator: string;
  nftId: number;
  status: "Delivered" | "Disaster" | "Fraud";
  notesHash: string;
  refundAmount: string;
  treasuryCompensation: string;
};
export type RegisterValidatorInput = {
  admin: string;
  validator: string;
};
export type SetListingBuyableInput = {
  admin: string;
  nftId: number;
  buyable: boolean;
};
export type RecordSatelliteAttestationInput = {
  admin: string;
  nftId: number;
  observedAt: number;
  ndviBps: number;
  minNdviBps: number;
  bboxHash: string;
  reportHash: string;
  source: string;
};

export type TransactionPreview = {
  xdr: string;
  hash: string;
  contractId: string;
  method: string;
  signedTxXdr?: string;
};

export type SubmitSignedXdrResult = {
  hash?: string;
  status?: string;
  errorResultXdr?: string;
};

const FALLBACK_NETWORK = STELLAR_NETWORK_PASSPHRASE;

function makeRpcServer() {
  return new rpc.Server(STELLAR_RPC_URL, { allowHttp: STELLAR_RPC_URL.startsWith("http://") });
}

function makeHorizonServer() {
  return new Horizon.Server(STELLAR_HORIZON_URL, {
    allowHttp: STELLAR_HORIZON_URL.startsWith("http://"),
  });
}

function getContractId(contract: ContractKey) {
  const value = CONTRACT_IDS[contract];

  if (!value) {
    throw new Error(
      `Missing NEXT_PUBLIC_${contract
        .replace(/[A-Z]/g, (letter) => `_${letter}`)
        .toUpperCase()}_CONTRACT_ID`,
    );
  }

  return value;
}

function parseTokenAmount(amount: string) {
  return toStroops(amount, 7);
}

/**
 * Convert a human-readable decimal amount string into integer base units
 * (e.g. XLM with 7 decimals: "2500.50" -> 25005000000n). Replaces the
 * removed `Soroban.parseTokenAmount` helper from older SDK versions.
 */
function toStroops(amount: string, decimals: number): bigint {
  const trimmed = (amount ?? "0").trim();
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const fracPadded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  const scale = 10n ** BigInt(decimals);
  const value = BigInt(whole || "0") * scale + BigInt(fracPadded || "0");
  return negative ? -value : value;
}

function hectaresToBps(area: number) {
  return Math.round(area * 10_000);
}

function harvestDateToUnix(date: string) {
  return Math.floor(new Date(date).getTime() / 1000);
}

async function loadSourceAccount(address: string) {
  const server = makeRpcServer();
  return server.getAccount(address);
}

async function buildPreparedContractTransaction(
  address: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
) {
  const account = await loadSourceAccount(address);
  const server = makeRpcServer();
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: FALLBACK_NETWORK,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(TimeoutInfinite)
    .build();

  return server.prepareTransaction(tx);
}

async function signPreparedTransaction(address: string, preparedXdr: string) {
  const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit");
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(preparedXdr, {
    address,
    networkPassphrase: FALLBACK_NETWORK,
  });

  return signedTxXdr;
}

function hashFromXdr(xdr: string) {
  const tx = TransactionBuilder.fromXDR(xdr, FALLBACK_NETWORK);
  return tx.hash().toString("hex");
}

export async function signPreparedXdr(address: string, preparedXdr: string) {
  const signedTxXdr = await signPreparedTransaction(address, preparedXdr);
  return {
    signedTxXdr,
    hash: hashFromXdr(signedTxXdr),
  };
}

export async function submitSignedXdr(signedXdr: string): Promise<SubmitSignedXdrResult> {
  const response = await fetch("/api/stellar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "submit_signed_xdr",
      payload: { signedXdr },
    }),
  });

  const json = (await response.json()) as SubmitSignedXdrResult & { error?: string };
  if (!response.ok) {
    throw new Error(json.error ?? "Failed to submit signed transaction");
  }

  return json;
}

export async function mintCropNft(input: MintCropInput): Promise<TransactionPreview> {
  const contractId = getContractId("agriCon");
  const price = parseTokenAmount(input.priceXlm);
  const prepared = await buildPreparedContractTransaction(
    input.farmer,
    contractId,
    "mint_crop_nft_with_listing",
    [
      nativeToScVal(input.farmer, { type: "address" }),
      nativeToScVal(input.cropType, { type: "string" }),
      nativeToScVal(BigInt(input.quantityKg), { type: "i128" }),
      nativeToScVal(price, { type: "i128" }),
      nativeToScVal(harvestDateToUnix(input.harvestDate), { type: "u64" }),
      nativeToScVal(input.parcelName, { type: "string" }),
      nativeToScVal(input.parcelBboxHash, { type: "string" }),
      nativeToScVal(hectaresToBps(input.parcelAreaHectares), { type: "u64" }),
      nativeToScVal(input.region, { type: "string" }),
      nativeToScVal(input.minNdviBps, { type: "u64" }),
      nativeToScVal(input.observationWindowDays, { type: "u32" }),
    ],
  );

  const xdr = prepared.toXDR();
  const signedTxXdr = await signPreparedTransaction(input.farmer, xdr);

  return {
    xdr,
    hash: hashFromXdr(xdr),
    contractId,
    method: "mint_crop_nft_with_listing",
    signedTxXdr,
  };
}

export async function buyCropNft(input: BuyCropInput): Promise<TransactionPreview> {
  const contractId = getContractId("agriCon");
  const prepared = await buildPreparedContractTransaction(
    input.buyer,
    contractId,
    "buy_crop_nft",
    [
      nativeToScVal(input.buyer, { type: "address" }),
      nativeToScVal(input.nftId, { type: "u64" }),
    ],
  );

  const xdr = prepared.toXDR();
  const signedTxXdr = await signPreparedTransaction(input.buyer, xdr);

  return {
    xdr,
    hash: hashFromXdr(xdr),
    contractId,
    method: "buy_crop_nft",
    signedTxXdr,
  };
}

export async function submitProof(input: ProofInput): Promise<TransactionPreview> {
  const contractId = getContractId("agriCon");
  const prepared = await buildPreparedContractTransaction(
    input.farmer,
    contractId,
    "submit_proof",
    [
      nativeToScVal(input.farmer, { type: "address" }),
      nativeToScVal(input.nftId, { type: "u64" }),
      nativeToScVal(input.proofHash, { type: "string" }),
    ],
  );

  const xdr = prepared.toXDR();
  const signedTxXdr = await signPreparedTransaction(input.farmer, xdr);

  return {
    xdr,
    hash: hashFromXdr(xdr),
    contractId,
    method: "submit_proof",
    signedTxXdr,
  };
}

export async function verifyDelivery(input: VerifyInput): Promise<TransactionPreview> {
  const contractId = getContractId("agriCon");
  const prepared = await buildPreparedContractTransaction(
    input.validator,
    contractId,
    "verify_delivery",
    [
      nativeToScVal(input.validator, { type: "address" }),
      nativeToScVal(input.nftId, { type: "u64" }),
      nativeToScVal(input.status, { type: "string" }),
      nativeToScVal(input.notesHash, { type: "string" }),
      nativeToScVal(parseTokenAmount(input.refundAmount), { type: "i128" }),
      nativeToScVal(parseTokenAmount(input.treasuryCompensation), {
        type: "i128",
      }),
    ],
  );

  const xdr = prepared.toXDR();
  const signedTxXdr = await signPreparedTransaction(input.validator, xdr);

  return {
    xdr,
    hash: hashFromXdr(xdr),
    contractId,
    method: "verify_delivery",
    signedTxXdr,
  };
}

export async function registerValidator(
  input: RegisterValidatorInput,
): Promise<TransactionPreview> {
  const contractId = getContractId("agriCon");
  const prepared = await buildPreparedContractTransaction(
    input.admin,
    contractId,
    "add_validator",
    [nativeToScVal(input.validator, { type: "address" })],
  );

  const xdr = prepared.toXDR();
  const signedTxXdr = await signPreparedTransaction(input.admin, xdr);

  return {
    xdr,
    hash: hashFromXdr(xdr),
    contractId,
    method: "add_validator",
    signedTxXdr,
  };
}

export async function setListingBuyable(
  input: SetListingBuyableInput,
): Promise<TransactionPreview> {
  const contractId = getContractId("agriCon");
  const prepared = await buildPreparedContractTransaction(
    input.admin,
    contractId,
    "set_listing_buyable",
    [
      nativeToScVal(input.nftId, { type: "u64" }),
      nativeToScVal(input.buyable, { type: "bool" }),
    ],
  );

  const xdr = prepared.toXDR();
  const signedTxXdr = await signPreparedTransaction(input.admin, xdr);

  return {
    xdr,
    hash: hashFromXdr(xdr),
    contractId,
    method: "set_listing_buyable",
    signedTxXdr,
  };
}

export async function recordSatelliteAttestation(
  input: RecordSatelliteAttestationInput,
): Promise<TransactionPreview> {
  const contractId = getContractId("agriCon");
  const prepared = await buildPreparedContractTransaction(
    input.admin,
    contractId,
    "record_satellite_attestation",
    [
      nativeToScVal(input.nftId, { type: "u64" }),
      nativeToScVal(input.observedAt, { type: "u64" }),
      nativeToScVal(input.ndviBps, { type: "u64" }),
      nativeToScVal(input.minNdviBps, { type: "u64" }),
      nativeToScVal(input.bboxHash, { type: "string" }),
      nativeToScVal(input.reportHash, { type: "string" }),
      nativeToScVal(input.source, { type: "string" }),
    ],
  );

  const xdr = prepared.toXDR();
  const signedTxXdr = await signPreparedTransaction(input.admin, xdr);

  return {
    xdr,
    hash: hashFromXdr(xdr),
    contractId,
    method: "record_satellite_attestation",
    signedTxXdr,
  };
}

export async function loadNetworkSnapshot() {
  const rpcServer = makeRpcServer();
  const horizonServer = makeHorizonServer();
  const [health, latestLedger, feeStats] = await Promise.all([
    rpcServer.getHealth(),
    rpcServer.getLatestLedger(),
    horizonServer.feeStats(),
  ]);

  return {
    rpcStatus: health.status,
    latestLedger: latestLedger.sequence,
    baseFee: feeStats.last_ledger_base_fee,
    networkPassphrase: FALLBACK_NETWORK,
  };
}
