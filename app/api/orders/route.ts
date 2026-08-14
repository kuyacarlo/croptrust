import { getOrders, createOrder } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filters: Record<string, string> = {};
    const buyerAddress = searchParams.get("buyerAddress");
    const farmerAddress = searchParams.get("farmerAddress");
    const status = searchParams.get("status");
    if (buyerAddress) filters.buyerAddress = buyerAddress;
    if (farmerAddress) filters.farmerAddress = farmerAddress;
    if (status) filters.status = status;
    const orders = await getOrders(filters);
    return Response.json({ ok: true, orders });
  } catch (err) {
    console.error("GET /api/orders:", err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { listingId, buyerAddress, amountXlm, txHash, status } = body;
    if (listingId == null || !buyerAddress) {
      return Response.json({ ok: false, error: "listingId and buyerAddress required" }, { status: 400 });
    }
    await createOrder({ listingId, buyerAddress, amountXlm, txHash, status });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/orders:", err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
