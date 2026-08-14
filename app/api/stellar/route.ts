import {
  prepareBuyCropNft,
  prepareSetFarmerProfileVerified,
  prepareMintCropNft,
  prepareRecordSatelliteAttestation,
  prepareSetListingBuyable,
  prepareSubmitProof,
  prepareUpsertFarmerProfile,
  prepareVerifyDelivery,
  submitSignedTransaction,
  submitVerifyDelivery,
} from "@/lib/stellar/backend";

import { getLiveListings, getLiveFarmerProfiles } from "@/lib/stellar/live-data";

import {
  CONTRACT_IDS,
  STELLAR_NETWORK_PASSPHRASE,
  STELLAR_RPC_URL,
  getAdminSecretKey,
} from "@/lib/stellar/config";

import {
  Contract,
  rpc,
  scValToNative,
  TimeoutInfinite,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";

export const runtime = "nodejs";

type BodyParams = Record<string, unknown>;

function makeRpcServer() {
  return new rpc.Server(STELLAR_RPC_URL, { allowHttp: STELLAR_RPC_URL.startsWith("http://") });
}

function getProbeAddress() {
  return (
    process.env.TREASURY_ADDRESS ??
    process.env.NEXT_PUBLIC_TREASURY_ADDRESS ??
    ""
  );
}

async function readContractValue(contractId: string, method: string, args: unknown[]) {
  const probe = getProbeAddress();
  if (!probe) throw new Error("Missing probe address");

  const server = makeRpcServer();
  const account = await server.getAccount(probe);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args as never[]))
    .setTimeout(TimeoutInfinite)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!sim.result?.retval) throw new Error(`No retval for ${method}`);
  return scValToNative(sim.result.retval);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action: string } & BodyParams;

    switch (body.action) {
      case "prepare_mint_crop_nft":
        return Response.json(await prepareMintCropNft(body as never));
      case "prepare_buy_crop_nft":
        return Response.json(await prepareBuyCropNft(body as never));
      case "prepare_upsert_farmer_profile":
        return Response.json(await prepareUpsertFarmerProfile(body as never));
      case "prepare_set_farmer_profile_verified":
        return Response.json(await prepareSetFarmerProfileVerified(body as never));
      case "prepare_submit_proof":
        return Response.json(await prepareSubmitProof(body as never));
      case "prepare_verify_delivery":
        return Response.json(await prepareVerifyDelivery(body as never));
      case "prepare_set_listing_buyable":
        return Response.json(await prepareSetListingBuyable(body as never));
      case "prepare_record_satellite_attestation":
        return Response.json(await prepareRecordSatelliteAttestation(body as never));
      case "verify_delivery": {
        const nftId = typeof body.nftId === "number" ? body.nftId : NaN;
        if (isNaN(nftId)) {
          return Response.json({ error: "nftId is required" }, { status: 400 });
        }
        const adminSecretKey = getAdminSecretKey();
        if (!adminSecretKey) {
          return Response.json({ error: "Admin not configured" }, { status: 500 });
        }
        const result = await submitVerifyDelivery(nftId, adminSecretKey);
        return Response.json({ ok: true, hash: result.hash, status: result.status });
      }
      case "submit_signed_xdr": {
        const payload = body.payload as Record<string, unknown> | undefined;
        const signedXdr = typeof payload?.signedXdr === "string" ? payload.signedXdr : "";
        if (!signedXdr) {
          return Response.json({ error: "signedXdr is required" }, { status: 400 });
        }
        return Response.json(await submitSignedTransaction(signedXdr));
      }

      case "get_treasury_pool": {
        try {
          const raw = await readContractValue(CONTRACT_IDS.agriCon!, "get_treasury_pool_balance", []);
          const balance = typeof raw === "bigint" ? Number(raw) : (typeof raw === "number" ? raw : 0);
          return Response.json({ ok: true, balance, totalDistributed: 0, aidedCount: 0 });
        } catch {
          return Response.json({ ok: true, balance: 0, totalDistributed: 0, aidedCount: 0 });
        }
      }

      case "get_farmer_profile": {
        const address = typeof body.farmerAddress === "string" ? body.farmerAddress : "";
        if (!address) {
          return Response.json({ ok: true, profile: null });
        }
        try {
          const profiles = await getLiveFarmerProfiles();
          const profile = profiles.find((p) => p.farmer === address) ?? null;
          return Response.json({ ok: true, profile });
        } catch {
          return Response.json({ ok: true, profile: null });
        }
      }

      case "get_all_listings": {
        try {
          const all = await getLiveListings();
          const listings = all.filter((l) => l.cropType !== null);
          return Response.json({ ok: true, listings });
        } catch {
          return Response.json({ ok: true, listings: [] });
        }
      }

      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    return Response.json({ error: message || "Unexpected server error" }, { status: 500 });
  }
}