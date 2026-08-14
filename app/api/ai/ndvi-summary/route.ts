import { nvidiaFetch, getNvidiaConfig } from "@/lib/nvidia-fetch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      ndviBps: number;
      cropType?: string;
      region?: string;
    };

    const { ndviBps, cropType, region } = body;

    if (ndviBps === undefined || ndviBps === null) {
      return Response.json({ error: "ndviBps is required" }, { status: 400 });
    }

    const ndviPercent = ((ndviBps / 100).toFixed(2)) + "%";
    const vegHealth =
      ndviBps > 6000
        ? "dense, healthy vegetation"
        : ndviBps > 4000
          ? "moderate vegetation"
          : ndviBps > 2000
            ? "sparse vegetation"
            : "very little vegetation (possibly bare soil or water)";

    const config = getNvidiaConfig();
    if (!config) {
      return Response.json({ error: "NVIDIA_API_KEY not configured" }, { status: 500 });
    }

    const { apiKey, model } = config;

    const prompt = `You are an agricultural analyst. Given the following satellite NDVI data for a crop parcel, explain what it means in plain language (2-3 sentences max) and give a short harvest recommendation.

NDVI: ${ndviPercent} (${ndviBps} basis points)
Vegetation health classification: ${vegHealth}
${cropType ? `Crop type: ${cropType}` : ""}
${region ? `Region: ${region}` : ""}

Respond ONLY with valid JSON — no markdown, no code fences, no extra text:
{"summary":"plain language explanation","recommendation":"actionable recommendation","healthLabel":"Healthy"}`;

    const res = await nvidiaFetch("/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You return ONLY valid JSON. No markdown, no backticks, no explanations outside the JSON object." },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return Response.json({ error: `NVIDIA API returned ${res.status}: ${errBody.slice(0, 200)}` }, { status: 502 });
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const raw = (json.choices?.[0]?.message?.content ?? "").trim();
    let parsed: { summary: string; recommendation: string; healthLabel: string };
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: "NVIDIA API returned invalid JSON", raw }, { status: 502 });
    }

    return Response.json({ ok: true, ...parsed, ndviBps, ndviPercent, vegHealth, cropType, region });
  } catch (err) {
    console.error("NDVI summary error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to generate NDVI summary" },
      { status: 500 },
    );
  }
}