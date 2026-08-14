import {
  BASE_FEE,
  Contract,
  Keypair,
  rpc,
  TimeoutInfinite,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";

import { CONTRACT_IDS, STELLAR_NETWORK_PASSPHRASE, STELLAR_RPC_URL } from "./config";


type ContractKey = keyof typeof CONTRACT_IDS;

type MintCropInput = {
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

type BuyCropInput = {
  buyer: string;
  nftId: number;
};
type UpsertFarmerProfileInput = {
  farmer: string;
  fullName: string;
  farmName: string;
  region: string;
  totalYieldKg: number;
};
type SetFarmerProfileVerifiedInput = {
  admin: string;
  farmer: string;
  verified: boolean;
};

type ProofInput = {
  farmer: string;
  nftId: number;
  proofHash: string;
};

type VerifyInput = {
  validator: string;
  nftId: number;
  status: "Delivered" | "Disaster" | "Fraud" | "Pending";
  notesHash: string;
  refundAmount: string;
  treasuryCompensation: string;
};
type SetListingBuyableInput = {
  admin: string;
  nftId: number;
  buyable: boolean;
};
type RecordSatelliteAttestationInput = {
  admin: string;
  nftId: number;
  observedAt: number;
  ndviBps: number;
  minNdviBps: number;
  bboxHash: string;
  reportHash: string;
  source: string;
};

export type UnsignedTxPreview = {
  xdr: string;
  hash: string;
  contractId: string;
  method: string;
};

function makeRpcServer() {
  return new rpc.Server(STELLAR_RPC_URL, { allowHttp: STELLAR_RPC_URL.startsWith("http://") });
}

function getContractId(contract: ContractKey) {
  const value = CONTRACT_IDS[contract];
  if (!value) {
    throw new Error(`Missing contract ID for ${contract}`);
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

async function buildPreparedContractTransaction(
  address: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
) {
  const server = makeRpcServer();
  const account = await server.getAccount(address);
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(TimeoutInfinite)
    .build();
  return server.prepareTransaction(tx);
}

function hashFromXdr(xdrTx: string) {
  return TransactionBuilder.fromXDR(xdrTx, STELLAR_NETWORK_PASSPHRASE).hash().toString("hex");
}

export async function prepareMintCropNft(input: MintCropInput): Promise<UnsignedTxPreview> {
  const contractId = getContractId("agriCon");
  const prepared = await buildPreparedContractTransaction(
    input.farmer,
    contractId,
    "mint_crop_nft_with_listing",
    [
      nativeToScVal(input.farmer, { type: "address" }),
      nativeToScVal(input.cropType, { type: "string" }),
      nativeToScVal(BigInt(input.quantityKg), { type: "i128" }),
      nativeToScVal(parseTokenAmount(input.priceXlm), { type: "i128" }),
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
  return { xdr, hash: hashFromXdr(xdr), contractId, method: "mint_crop_nft_with_listing" };
}

export async function prepareBuyCropNft(input: BuyCropInput): Promise<UnsignedTxPreview> {
  const contractId = getContractId("agriCon");
  const prepared = await buildPreparedContractTransaction(input.buyer, contractId, "buy_crop_nft", [
    nativeToScVal(input.buyer, { type: "address" }),
    nativeToScVal(input.nftId, { type: "u64" }),
  ]);
  const xdr = prepared.toXDR();
  return { xdr, hash: hashFromXdr(xdr), contractId, method: "buy_crop_nft" };
}

export async function prepareUpsertFarmerProfile(
  input: UpsertFarmerProfileInput,
): Promise<UnsignedTxPreview> {
  const contractId = getContractId("agriCon");
  const prepared = await buildPreparedContractTransaction(
    input.farmer,
    contractId,
    "upsert_farmer_profile",
    [
      nativeToScVal(input.farmer, { type: "address" }),
      nativeToScVal(input.fullName, { type: "string" }),
      nativeToScVal(input.farmName, { type: "string" }),
      nativeToScVal(input.region, { type: "string" }),
      nativeToScVal(BigInt(input.totalYieldKg), { type: "i128" }),
    ],
  );
  const xdr = prepared.toXDR();
  return { xdr, hash: hashFromXdr(xdr), contractId, method: "upsert_farmer_profile" };
}

export async function prepareSetFarmerProfileVerified(
  input: SetFarmerProfileVerifiedInput,
): Promise<UnsignedTxPreview> {
  const contractId = getContractId("agriCon");
  const prepared = await buildPreparedContractTransaction(
    input.admin,
    contractId,
    "set_farmer_profile_verified",
    [
      nativeToScVal(input.farmer, { type: "address" }),
      nativeToScVal(input.verified, { type: "bool" }),
    ],
  );
  const xdr = prepared.toXDR();
  return { xdr, hash: hashFromXdr(xdr), contractId, method: "set_farmer_profile_verified" };
}

export async function prepareSubmitProof(input: ProofInput): Promise<UnsignedTxPreview> {
  const contractId = getContractId("agriCon");
  const prepared = await buildPreparedContractTransaction(input.farmer, contractId, "submit_proof", [
    nativeToScVal(input.farmer, { type: "address" }),
    nativeToScVal(input.nftId, { type: "u64" }),
    nativeToScVal(input.proofHash, { type: "string" }),
  ]);
  const xdr = prepared.toXDR();
  return { xdr, hash: hashFromXdr(xdr), contractId, method: "submit_proof" };
}

export async function prepareVerifyDelivery(input: VerifyInput): Promise<UnsignedTxPreview> {
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
      nativeToScVal(parseTokenAmount(input.treasuryCompensation), { type: "i128" }),
    ],
  );
  const xdr = prepared.toXDR();
  return { xdr, hash: hashFromXdr(xdr), contractId, method: "verify_delivery" };
}

export async function prepareSetListingBuyable(
  input: SetListingBuyableInput,
): Promise<UnsignedTxPreview> {
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
  return { xdr, hash: hashFromXdr(xdr), contractId, method: "set_listing_buyable" };
}

export async function prepareRecordSatelliteAttestation(
  input: RecordSatelliteAttestationInput,
): Promise<UnsignedTxPreview> {
  const contractId = getContractId("agriCon");
  // NOTE: the contract method takes 7 args and computes `buyable` internally
  // (buyable = ndvi_bps >= min_ndvi_bps). It is admin-authorized via
  // require_admin(), so `input.admin` must be the on-chain admin and the
  // resulting XDR must be signed by that wallet.
  const prepared = await buildPreparedContractTransaction(
    input.admin,
    contractId,
    "record_satellite_attestation",
    [
      nativeToScVal(BigInt(input.nftId), { type: "u64" }),
      nativeToScVal(input.observedAt, { type: "u64" }),
      nativeToScVal(input.ndviBps, { type: "u64" }),
      nativeToScVal(input.minNdviBps, { type: "u64" }),
      nativeToScVal(input.bboxHash, { type: "string" }),
      nativeToScVal(input.reportHash, { type: "string" }),
      nativeToScVal(input.source, { type: "string" }),
    ],
  );
  const xdr = prepared.toXDR();
  return { xdr, hash: hashFromXdr(xdr), contractId, method: "record_satellite_attestation" };
}

export async function submitSignedTransaction(signedXdr: string) {
  const server = makeRpcServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
  const sendResult = await server.sendTransaction(tx);
  return sendResult;
}

export async function submitVerifyDelivery(
  nftId: number,
  adminSecretKey: string,
) {
  const adminKp = Keypair.fromSecret(adminSecretKey);
  const adminAddr = adminKp.publicKey();
  const server = makeRpcServer();
  const account = await server.getAccount(adminAddr);
  const contractId = getContractId("agriCon");
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("verify_delivery", ...[
        nativeToScVal(adminAddr, { type: "address" }),
        nativeToScVal(BigInt(nftId), { type: "u64" }),
        nativeToScVal("Delivered", { type: "string" }),
        nativeToScVal("", { type: "string" }),
        nativeToScVal(0n, { type: "i128" }),
        nativeToScVal(0n, { type: "i128" }),
      ]),
    )
    .setTimeout(TimeoutInfinite)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(adminKp);
  return server.sendTransaction(prepared);
}

export async function submitRecordSatelliteAttestation(
  input: Omit<RecordSatelliteAttestationInput, "admin"> & { adminSecretKey: string },
) {
  const adminKp = Keypair.fromSecret(input.adminSecretKey);
  const adminAddr = adminKp.publicKey();
  const server = makeRpcServer();
  const account = await server.getAccount(adminAddr);
  const contractId = getContractId("agriCon");
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("record_satellite_attestation", ...[
        nativeToScVal(BigInt(input.nftId), { type: "u64" }),
        nativeToScVal(input.observedAt, { type: "u64" }),
        nativeToScVal(input.ndviBps, { type: "u64" }),
        nativeToScVal(input.minNdviBps, { type: "u64" }),
        nativeToScVal(input.bboxHash, { type: "string" }),
        nativeToScVal(input.reportHash, { type: "string" }),
        nativeToScVal(input.source, { type: "string" }),
      ]),
    )
    .setTimeout(TimeoutInfinite)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(adminKp);
  return server.sendTransaction(prepared);
}

export async function submitUpsertFarmerProfile(
  input: UpsertFarmerProfileInput & { adminSecretKey: string },
) {
  const adminKp = Keypair.fromSecret(input.adminSecretKey);
  const adminAddr = adminKp.publicKey();
  const server = makeRpcServer();
  const account = await server.getAccount(adminAddr);
  const contractId = getContractId("agriCon");
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("upsert_farmer_profile", ...[
        nativeToScVal(input.farmer, { type: "address" }),
        nativeToScVal(input.fullName, { type: "string" }),
        nativeToScVal(input.farmName, { type: "string" }),
        nativeToScVal(input.region, { type: "string" }),
        nativeToScVal(BigInt(input.totalYieldKg), { type: "i128" }),
      ]),
    )
    .setTimeout(TimeoutInfinite)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(adminKp);
  return server.sendTransaction(prepared);
}

export async function submitSetFarmerProfileVerified(
  farmerAddress: string,
  adminSecretKey: string,
) {
  const adminKp = Keypair.fromSecret(adminSecretKey);
  const adminAddr = adminKp.publicKey();
  const server = makeRpcServer();
  const account = await server.getAccount(adminAddr);
  const contractId = getContractId("agriCon");
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("set_farmer_profile_verified", ...[
        nativeToScVal(farmerAddress, { type: "address" }),
        nativeToScVal(true, { type: "bool" }),
      ]),
    )
    .setTimeout(TimeoutInfinite)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(adminKp);
  return server.sendTransaction(prepared);
}
