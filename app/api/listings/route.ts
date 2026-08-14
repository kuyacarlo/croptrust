import { getListings, upsertListing } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filters: Record<string, unknown> = {};
    const buyable = searchParams.get("buyable");
    const region = searchParams.get("region");
    const farmerId = searchParams.get("farmerId");
    const search = searchParams.get("search");
    if (buyable !== null) filters.buyable = buyable === "true";
    if (region) filters.region = region;
    if (farmerId) filters.farmerId = farmerId;
    if (search) filters.search = search;
    const listings = await getListings(filters as Parameters<typeof getListings>[0]);
    return Response.json({ ok: true, listings });
  } catch (err) {
    console.error("GET /api/listings:", err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nftId, cropType, quantityKg, priceXlm, farmerId, parcelName, region, buyable, ndviBps, minNdviBps, areaHa, totalYieldKg, status } = body;
    if (nftId == null || !farmerId) {
      return Response.json({ ok: false, error: "nftId and farmerId required" }, { status: 400 });
    }
    await upsertListing({ nftId, cropType, quantityKg, priceXlm, farmerId, parcelName, region, buyable, ndviBps, minNdviBps, areaHa, totalYieldKg, status });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/listings:", err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
