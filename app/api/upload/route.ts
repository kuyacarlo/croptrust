export const runtime = "nodejs";

import { getSupabaseAdmin } from "@/lib/supabase-client";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) || "crop-images";
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return Response.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return Response.json(
        { ok: false, error: "Supabase storage is not configured" },
        { status: 500 },
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(safeName, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return Response.json({
      ok: true,
      path: data.path,
      url: urlData.publicUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
