import { getReviews, createReview } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filters: Record<string, string> = {};
    const farmerId = searchParams.get("farmerId");
    const orderId = searchParams.get("orderId");
    const reviewer = searchParams.get("reviewer");
    if (farmerId) filters.farmerId = farmerId;
    if (orderId) filters.orderId = orderId;
    if (reviewer) filters.reviewer = reviewer;
    const reviews = await getReviews(filters);
    return Response.json({ ok: true, reviews });
  } catch (err) {
    console.error("GET /api/reviews:", err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, reviewer, farmerId, rating, comment } = body;
    if (!orderId || !reviewer || !farmerId || !rating) {
      return Response.json({ ok: false, error: "orderId, reviewer, farmerId, and rating required" }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
      return Response.json({ ok: false, error: "rating must be 1-5" }, { status: 400 });
    }
    await createReview({ orderId, reviewer, farmerId, rating, comment });
    return Response.json({ ok: true });
  } catch (err) {
    const error = err as Error & { code?: string };
    if (error.code === "23505") {
      return Response.json({ ok: false, error: "You already reviewed this order" }, { status: 409 });
    }
    console.error("POST /api/reviews:", err);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
