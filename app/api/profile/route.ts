import { getFarmer, listFarmers, upsertFarmer } from "@/lib/db";
import { submitUpsertFarmerProfile, submitSetFarmerProfileVerified } from "@/lib/stellar/backend";
import { getAdminSecretKey } from "@/lib/stellar/config";

function toCamel(row: Record<string, unknown> | null) {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    if (address) {
      const profile = await getFarmer(address);
      return Response.json({ ok: true, profile: toCamel(profile as Record<string, unknown> | null) });
    }
    const farmers = await listFarmers();
    return Response.json({ ok: true, profiles: farmers.map((f) => toCamel(f as Record<string, unknown>)) });
  } catch (err) {
    console.error("GET /api/profile:", err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { address, fullName, farmName, region, totalYieldKg, idDocPath } = body;
    if (!address || !fullName) {
      return Response.json({ ok: false, error: "address and fullName required" }, { status: 400 });
    }
    const profile = await upsertFarmer({
      id: address, fullName, farmName, region,
      totalYieldKg: totalYieldKg || 0, idDocPath, verified: true,
    });

    // Write profile on-chain + auto-verify via admin key
    const adminSecretKey = getAdminSecretKey();
    if (adminSecretKey) {
      submitUpsertFarmerProfile({
        farmer: address, fullName, farmName: farmName ?? "", region: region ?? "",
        totalYieldKg: totalYieldKg || 0, adminSecretKey,
      }).then(() => submitSetFarmerProfileVerified(address, adminSecretKey))
       .catch((e: Error) => console.error("on-chain profile failed:", e));
    } else {
      console.warn("No attestor/admin key set (ADMIN_SECRET_KEY / STELLAR_ADMIN_SECRET / ORACLE_SECRET_KEY) — skipping on-chain profile");
    }

    return Response.json({ ok: true, profile: toCamel(profile as Record<string, unknown>) });
  } catch (err) {
    console.error("POST /api/profile:", err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
