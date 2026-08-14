import { getAverageRating } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ farmerId: string }> }) {
  try {
    const { farmerId } = await params;
    const rating = await getAverageRating(farmerId);
    return Response.json({ ok: true, ...rating });
  } catch (err) {
    console.error("GET /api/reviews/rating/[farmerId]:", err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
