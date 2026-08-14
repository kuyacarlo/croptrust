import {
  BASE_FEE,
  Contract,
  rpc,
  scValToNative,
  TimeoutInfinite,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";

import { CONTRACT_IDS, STELLAR_NETWORK_PASSPHRASE, STELLAR_RPC_URL } from "./config";

export type LiveListing = {
  nftId: number;
  cropType: string | null;
  quantityKg: number | null;
  priceXlm: string | null;
  farmer: string | null;
  harvestDate: number | null;
  cropStatus: string | null;
  buyable: boolean;
  observedAt: number | null;
  ndviBps: number | null;
  minNdviBps: number | null;
  source: string | null;
  parcelName: string | null;
  parcelBboxHash: string | null;
  parcelAreaHectares: number | null;
  region: string | null;
  observationWindowDays: number | null;
  totalYieldKg: number | null;
};

export type LiveFarmerProfile = {
  farmer: string;
  fullName: string;
  farmName: string;
  region: string;
  verified: boolean;
  totalYieldKg: number;
  updatedAt: number;
};

const CONTRACT_ID = CONTRACT_IDS.agriCon;

function makeRpcServer() {
  return new rpc.Server(STELLAR_RPC_URL, { allowHttp: STELLAR_RPC_URL.startsWith("http://") });
}

function withTimeout<T>(promise: Promise<T>, label: string, ms = 7000) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`${label} timed out after ${ms}ms`));
      }, ms);
    }),
  ]);
}

function getProbeAddress() {
  return (
    process.env.TREASURY_ADDRESS ??
    process.env.NEXT_PUBLIC_TREASURY_ADDRESS ??
    ""
  );
}

let _cachedNextId: number | null = null;

async function parseNftIds(): Promise<number[]> {
  // 1. If ACTIVE_NFT_IDS is set, use that explicit list
  const raw = process.env.ACTIVE_NFT_IDS ?? process.env.NEXT_PUBLIC_ACTIVE_NFT_IDS ?? null;
  if (raw) {
    const ids = raw
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isInteger(v) && v > 0);
    if (ids.length > 0) return ids;
  }

  // 2. Read get_next_nft_id from contract to discover all NFTs dynamically
  if (_cachedNextId === null) {
    try {
      const val = await readContract("get_next_nft_id", []);
      const id = typeof val === "bigint" ? Number(val) : typeof val === "number" ? val : null;
      if (id !== null && id > 1) _cachedNextId = id;
    } catch { /* fall through */ }
  }
  if (_cachedNextId !== null) {
    return Array.from({ length: _cachedNextId - 1 }, (_, i) => i + 1);
  }

  // 3. Fallback: env var max or default 20
  const max = parseInt(process.env.NFT_MAX_ID ?? process.env.NEXT_PUBLIC_NFT_MAX_ID ?? "20", 10);
  return Array.from({ length: max }, (_, i) => i + 1);
}

async function fetchAllFarmerAddresses(): Promise<string[]> {
  const raw = process.env.FARMER_ADDRESSES ?? process.env.NEXT_PUBLIC_FARMER_ADDRESSES ?? "";
  const fromEnv = raw.split(",").map((v) => v.trim()).filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  // fallback: pull from Supabase
  try {
    const { listFarmers } = await import("@/lib/db");
    const farmers = await listFarmers();
    return farmers.map((f) => f.id).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

let _farmerCache: { addresses: string[]; ts: number } | null = null;

async function parseFarmerAddresses(): Promise<string[]> {
  if (_farmerCache && Date.now() - _farmerCache.ts < 60_000) return _farmerCache.addresses;
  const addresses = await fetchAllFarmerAddresses();
  _farmerCache = { addresses, ts: Date.now() };
  return addresses;
}

function scNumberToNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatTokenFromStroops(value: unknown): string | null {
  const raw = scNumberToNumber(value);
  if (raw === null) return null;
  return (raw / 10_000_000).toFixed(2);
}

async function readContract(method: string, args: xdr.ScVal[]) {
  if (!CONTRACT_ID) {
    throw new Error("Missing contract id");
  }

  const probe = getProbeAddress();
  if (!probe) {
    throw new Error("Missing probe address (set TREASURY_ADDRESS)");
  }

  const server = makeRpcServer();
  const account = await server.getAccount(probe);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(TimeoutInfinite)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  if (!sim.result?.retval) {
    throw new Error(`No return value for ${method}`);
  }

  return scValToNative(sim.result.retval);
}

export async function getLiveListings(): Promise<LiveListing[]> {
  const ids = await parseNftIds();
  return Promise.all(
    ids.map(async (nftId) => {
      let cropType: string | null = null;
      let quantityKg: number | null = null;
      let priceXlm: string | null = null;
      let farmer: string | null = null;
      let harvestDate: number | null = null;
      let cropStatus: string | null = null;
      let buyable = false;
      try {
        const result = await withTimeout(
          readContract("is_listing_buyable", [nativeToScVal(nftId, { type: "u64" })]),
          `read buyable state for nft ${nftId}`,
        );
        buyable = Boolean(result);
      } catch {
        buyable = false;
      }

      let observedAt: number | null = null;
      let ndviBps: number | null = null;
      let minNdviBps: number | null = null;
      let source: string | null = null;
      let parcelName: string | null = null;
      let parcelBboxHash: string | null = null;
      let parcelAreaHectares: number | null = null;
      let region: string | null = null;
      let observationWindowDays: number | null = null;
      const totalYieldKg: number | null = null;

      try {
        const crop = (await withTimeout(
          readContract("get_crop", [nativeToScVal(nftId, { type: "u64" })]),
          `read crop metadata for nft ${nftId}`,
        )) as Record<string, unknown>;
        cropType = typeof crop.crop_type === "string" ? crop.crop_type : null;
        quantityKg = scNumberToNumber(crop.quantity);
        priceXlm = formatTokenFromStroops(crop.price);
        farmer = typeof crop.farmer === "string" ? crop.farmer : null;
        harvestDate = scNumberToNumber(crop.harvest_date);
        cropStatus = typeof crop.status === "string" ? crop.status : null;
      } catch {
      }

      try {
        const attestation = (await withTimeout(
          readContract("get_satellite_attestation", [nativeToScVal(nftId, { type: "u64" })]),
          `read attestation for nft ${nftId}`,
        )) as Record<string, unknown>;
        observedAt = typeof attestation.observed_at === "number" ? attestation.observed_at : null;
        ndviBps = typeof attestation.ndvi_bps === "number" ? attestation.ndvi_bps : null;
        minNdviBps =
          typeof attestation.min_ndvi_bps === "number" ? attestation.min_ndvi_bps : null;
        source = typeof attestation.source === "string" ? attestation.source : null;
      } catch {
      }

      try {
        const listing = (await withTimeout(
          readContract("get_listing_metadata", [nativeToScVal(nftId, { type: "u64" })]),
          `read listing metadata for nft ${nftId}`,
        )) as Record<string, unknown>;
        parcelName = typeof listing.parcel_name === "string" ? listing.parcel_name : null;
        parcelBboxHash =
          typeof listing.parcel_bbox_hash === "string" ? listing.parcel_bbox_hash : null;
        const areaBps = scNumberToNumber(listing.parcel_area_hectares_bps);
        parcelAreaHectares = areaBps === null ? null : areaBps / 10_000;
        region = typeof listing.region === "string" ? listing.region : region;
        observationWindowDays = scNumberToNumber(listing.observation_window_days);
        if (minNdviBps === null) {
          minNdviBps = scNumberToNumber(listing.min_ndvi_bps);
        }
      } catch {
      }

      return {
        nftId,
        cropType,
        quantityKg,
        priceXlm,
        farmer,
        harvestDate,
        cropStatus,
        buyable,
        observedAt,
        ndviBps,
        minNdviBps,
        source,
        parcelName,
        parcelBboxHash,
        parcelAreaHectares,
        region,
        observationWindowDays,
        totalYieldKg,
      };
    }),
  );
}

export async function getLiveFarmerProfiles(): Promise<LiveFarmerProfile[]> {
  if (!CONTRACT_ID) return [];
  const farmers = await parseFarmerAddresses();
  if (farmers.length === 0) return [];

  const profiles = await Promise.all(
    farmers.map(async (farmer) => {
      try {
        const result = (await withTimeout(
          readContract("get_farmer_profile", [
            nativeToScVal(farmer, { type: "address" }),
          ]),
          `read farmer profile for ${farmer}`,
        )) as Record<string, unknown>;

        return {
          farmer,
          fullName: typeof result.full_name === "string" ? result.full_name : "",
          farmName: typeof result.farm_name === "string" ? result.farm_name : "",
          region: typeof result.region === "string" ? result.region : "",
          verified: Boolean(result.verified),
          totalYieldKg:
            typeof result.total_yield_kg === "number"
              ? result.total_yield_kg
              : Number(result.total_yield_kg ?? 0),
          updatedAt: typeof result.updated_at === "number" ? result.updated_at : 0,
        } satisfies LiveFarmerProfile;
      } catch {
        return null;
      }
    }),
  );

  return profiles.filter((profile): profile is LiveFarmerProfile => profile !== null);
}