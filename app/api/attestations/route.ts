import { recordAttestation } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nftId, observedAt, ndviBps, minNdviBps, buyable, bboxHash, reportHash, source } = body;
    if (nftId == null) {
      return Response.json({ ok: false, error: "nftId required" }, { status: 400 });
    }
    await recordAttestation({ nftId, observedAt, ndviBps, minNdviBps, buyable, bboxHash, reportHash, source });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/attestations:", err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
