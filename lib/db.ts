import { getNeonClient } from "./neon-client";

function sql() {
  const client = getNeonClient();
  if (!client) throw new Error("DATABASE_URL not configured");
  return client;
}

export async function upsertFarmer(data: {
  id: string; fullName: string; farmName?: string; region?: string;
  totalYieldKg?: number; idDocPath?: string | null; verified?: boolean;
}) {
  const q = sql();
  await q`
    INSERT INTO farmers (id, full_name, farm_name, region, total_yield_kg, id_doc_path, verified)
    VALUES (${data.id}, ${data.fullName}, ${data.farmName ?? ""}, ${data.region ?? ""},
            ${data.totalYieldKg ?? 0}, ${data.idDocPath ?? null}, ${data.verified ?? false})
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      farm_name = EXCLUDED.farm_name,
      region = EXCLUDED.region,
      total_yield_kg = EXCLUDED.total_yield_kg,
      id_doc_path = COALESCE(EXCLUDED.id_doc_path, farmers.id_doc_path),
      verified = EXCLUDED.verified
  `;
  return getFarmer(data.id);
}

export async function getFarmer(id: string) {
  const q = sql();
  const rows = await q`SELECT * FROM farmers WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

export async function listFarmers() {
  const q = sql();
  const rows = await q`SELECT * FROM farmers ORDER BY updated_at DESC`;
  return rows;
}

export async function upsertListing(data: {
  nftId: number; cropType?: string; quantityKg?: number; priceXlm?: number;
  farmerId: string; parcelName?: string; region?: string; buyable?: boolean;
  ndviBps?: number; minNdviBps?: number; areaHa?: number; totalYieldKg?: number; status?: string;
}) {
  const q = sql();
  await q`
    INSERT INTO listings (nft_id, crop_type, quantity_kg, price_usdc, farmer_id, parcel_name, region, buyable, ndvi_bps, min_ndvi_bps, area_ha, total_yield_kg, status)
    VALUES (${data.nftId}, ${data.cropType ?? null}, ${data.quantityKg ?? null},
            ${data.priceXlm ?? null}, ${data.farmerId}, ${data.parcelName ?? null},
            ${data.region ?? null}, ${data.buyable ?? false}, ${data.ndviBps ?? null},
            ${data.minNdviBps ?? null}, ${data.areaHa ?? null}, ${data.totalYieldKg ?? null},
            ${data.status ?? "minted"})
    ON CONFLICT (nft_id) DO UPDATE SET
      crop_type = EXCLUDED.crop_type,
      quantity_kg = EXCLUDED.quantity_kg,
      price_usdc = EXCLUDED.price_usdc,
      parcel_name = EXCLUDED.parcel_name,
      region = EXCLUDED.region,
      buyable = EXCLUDED.buyable,
      ndvi_bps = EXCLUDED.ndvi_bps,
      min_ndvi_bps = EXCLUDED.min_ndvi_bps,
      area_ha = EXCLUDED.area_ha,
      total_yield_kg = EXCLUDED.total_yield_kg,
      status = EXCLUDED.status
  `;
}

export async function getListings(filters: {
  buyable?: boolean; region?: string; farmerId?: string; search?: string;
} = {}) {
  const q = sql();
  // Build dynamic query — Neon tagged templates handle parameterization
  let whereClause = "WHERE 1=1";
  const params: unknown[] = [];

  if (filters.buyable !== undefined) {
    whereClause += ` AND l.buyable = ${filters.buyable}`;
  }
  if (filters.region) {
    whereClause += ` AND l.region = '${filters.region.replace(/'/g, "''")}'`;
  }
  if (filters.farmerId) {
    whereClause += ` AND l.farmer_id = '${filters.farmerId.replace(/'/g, "''")}'`;
  }

  // For search and dynamic filters, use a simpler approach
  if (filters.search) {
    const s = `%${filters.search}%`;
    const rows = await q`
      SELECT l.*, json_build_object('full_name', f.full_name, 'farm_name', f.farm_name, 'region', f.region, 'verified', f.verified) as farmer
      FROM listings l LEFT JOIN farmers f ON l.farmer_id = f.id
      WHERE (${filters.buyable === undefined} OR l.buyable = ${filters.buyable ?? false})
        AND (${!filters.region} OR l.region = ${filters.region ?? ""})
        AND (${!filters.farmerId} OR l.farmer_id = ${filters.farmerId ?? ""})
        AND (l.parcel_name ILIKE ${s} OR l.crop_type ILIKE ${s} OR l.region ILIKE ${s})
      ORDER BY l.created_at DESC
    `;
    return rows;
  }

  const rows = await q`
    SELECT l.*, json_build_object('full_name', f.full_name, 'farm_name', f.farm_name, 'region', f.region, 'verified', f.verified) as farmer
    FROM listings l LEFT JOIN farmers f ON l.farmer_id = f.id
    WHERE (${filters.buyable === undefined} OR l.buyable = ${filters.buyable ?? false})
      AND (${!filters.region} OR l.region = ${filters.region ?? ""})
      AND (${!filters.farmerId} OR l.farmer_id = ${filters.farmerId ?? ""})
    ORDER BY l.created_at DESC
  `;
  return rows;
}

export async function createOrder(data: {
  listingId: number; buyerAddress: string; amountXlm?: number; txHash?: string; status?: string;
}) {
  const q = sql();
  await q`
    INSERT INTO orders (listing_id, buyer_address, amount_usdc, tx_hash, status)
    VALUES (${data.listingId}, ${data.buyerAddress}, ${data.amountXlm ?? 0},
            ${data.txHash ?? null}, ${data.status ?? "escrow"})
  `;
}

export async function getOrders(filters: {
  buyerAddress?: string; farmerAddress?: string; status?: string;
} = {}) {
  const q = sql();
  const rows = await q`
    SELECT o.*,
      json_build_object(
        'nft_id', l.nft_id, 'crop_type', l.crop_type, 'parcel_name', l.parcel_name,
        'region', l.region, 'price_usdc', l.price_usdc, 'farmer_id', l.farmer_id,
        'farmer', json_build_object('full_name', f.full_name, 'farm_name', f.farm_name)
      ) as listing
    FROM orders o
    LEFT JOIN listings l ON o.listing_id = l.id
    LEFT JOIN farmers f ON l.farmer_id = f.id
    WHERE (${!filters.buyerAddress} OR o.buyer_address = ${filters.buyerAddress ?? ""})
      AND (${!filters.status} OR o.status = ${filters.status ?? ""})
      AND (${!filters.farmerAddress} OR l.farmer_id = ${filters.farmerAddress ?? ""})
    ORDER BY o.created_at DESC
  `;
  return rows;
}

export async function recordAttestation(data: {
  nftId: number; observedAt: number; ndviBps: number;
  minNdviBps: number; buyable: boolean; bboxHash: string; reportHash: string; source?: string;
}) {
  const q = sql();
  await q`
    INSERT INTO attestations (nft_id, observed_at, ndvi_bps, min_ndvi_bps, buyable, bbox_hash, report_hash, source)
    VALUES (${data.nftId}, ${new Date(data.observedAt * 1000).toISOString()},
            ${data.ndviBps}, ${data.minNdviBps}, ${data.buyable},
            ${data.bboxHash}, ${data.reportHash}, ${data.source ?? "copernicus-sentinel2"})
  `;
}

export async function createReview(data: {
  orderId: string; reviewer: string; farmerId: string; rating: number; comment?: string;
}) {
  const q = sql();
  try {
    await q`
      INSERT INTO reviews (order_id, reviewer, farmer_id, rating, comment)
      VALUES (${data.orderId}, ${data.reviewer}, ${data.farmerId},
              ${data.rating}, ${data.comment ?? null})
    `;
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "23505") throw Object.assign(new Error("Duplicate review"), { statusCode: 409 });
    throw err;
  }
}

export async function getReviews(filters: {
  farmerId?: string; orderId?: string; reviewer?: string;
} = {}) {
  const q = sql();
  const rows = await q`
    SELECT r.*,
      json_build_object('parcel_name', l.parcel_name, 'crop_type', l.crop_type) as listing_info
    FROM reviews r
    LEFT JOIN orders o ON r.order_id = o.id
    LEFT JOIN listings l ON o.listing_id = l.id
    WHERE (${!filters.farmerId} OR r.farmer_id = ${filters.farmerId ?? ""})
      AND (${!filters.orderId} OR r.order_id = ${filters.orderId ?? ""})
      AND (${!filters.reviewer} OR r.reviewer = ${filters.reviewer ?? ""})
    ORDER BY r.created_at DESC
  `;
  return rows;
}

export async function getAverageRating(farmerId: string) {
  const q = sql();
  const rows = await q`SELECT rating FROM reviews WHERE farmer_id = ${farmerId}`;
  if (!rows || rows.length === 0) return { average: 0, count: 0 };
  const sum = rows.reduce((a: number, r) => a + (r.rating as number), 0 as number);
  return { average: sum / rows.length, count: rows.length };
}
