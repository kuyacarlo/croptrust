export const runtime = "nodejs";

let cache: { xlmUsd: number; timestamp: number } | null = null;

async function fetchXlmPrice() {
  if (cache && Date.now() - cache.timestamp < 300_000) {
    return cache.xlmUsd;
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const json = (await res.json()) as { stellar?: { usd?: number } };
    const price = json.stellar?.usd;
    if (typeof price !== "number" || price <= 0) throw new Error("invalid price");
    cache = { xlmUsd: price, timestamp: Date.now() };
    return price;
  } catch {
    return cache?.xlmUsd ?? 0.27;
  }
}

export async function GET() {
  try {
    const xlmUsd = await fetchXlmPrice();
    return Response.json({
      ok: true,
      xlmUsd,
      usdcPerXlm: xlmUsd > 0 ? 1 / xlmUsd : 0,
      xlmPerUsdc: xlmUsd > 0 ? xlmUsd : 0,
      cached: cache?.timestamp ? new Date(cache.timestamp).toISOString() : null,
    });
  } catch {
    return Response.json({ ok: false, xlmUsd: cache?.xlmUsd ?? 0.27 }, { status: 500 });
  }
}