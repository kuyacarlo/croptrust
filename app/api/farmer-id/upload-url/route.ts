export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

type Body = {
  farmerAddress: string;
  fileName: string;
  contentType: string;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Prefer a service-role key (server-side, full control). Fall back to a
// publishable/anon key, which works when the bucket has an RLS insert policy.
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";
const BUCKET = process.env.SUPABASE_FARMER_ID_BUCKET ?? "farmer-ids";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.farmerAddress || !body?.fileName || !body?.contentType) {
      return Response.json(
        { ok: false, error: "Missing farmerAddress, fileName, or contentType" },
        { status: 400 },
      );
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return Response.json(
        {
          ok: false,
          error:
            "Supabase storage is not configured. Set SUPABASE_URL and a Supabase key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY).",
        },
        { status: 400 },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const safeName = sanitizeFileName(body.fileName);
    const objectPath = `${body.farmerAddress}/${Date.now()}-${safeName}`;

    // Create a short-lived signed upload URL. The client PUTs the file directly
    // to this URL so large documents never pass through our server.
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(objectPath, { upsert: true });

    if (error || !data) {
      return Response.json(
        { ok: false, error: error?.message ?? "Failed to create upload URL" },
        { status: 500 },
      );
    }

    return Response.json({
      ok: true,
      bucket: BUCKET,
      objectPath: data.path ?? objectPath,
      uploadUrl: data.signedUrl,
      token: data.token,
      // Supabase signed upload URLs are valid for 2 hours.
      expiresInSeconds: 7200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create upload URL";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
