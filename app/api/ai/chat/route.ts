import { nvidiaFetch, getNvidiaConfig } from "@/lib/nvidia-fetch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages: { role: "user" | "assistant"; content: string }[];
      context?: string;
    };
    const { messages, context } = body;

    if (!messages?.length) {
      return Response.json({ error: "messages array is required" }, { status: 400 });
    }

    const config = getNvidiaConfig();
    if (!config) {
      return Response.json({ error: "NVIDIA_API_KEY not configured" }, { status: 500 });
    }

    const { apiKey, model } = config;

    const systemPrompt = [
      "You are AgriAI, an agricultural assistant for the CropTrust platform on the Stellar blockchain.",
      "You help farmers and buyers understand:",
      "- Satellite NDVI data and what vegetation health means for crop yields",
      "- Weather impacts on harvest predictions",
      "- Forward contract terms (XLM escrow, 20% upfront + 70% on delivery + 10% treasury)",
      "- When to buy or sell crop NFTs",
      "",
      "Keep answers concise (2-4 sentences). Use plain language.",
      context ? `\nCurrent context: ${context}` : "",
    ].join("\n");

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    const res = await nvidiaFetch("/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    const text = await res.text();
    let json: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };

    try {
      json = JSON.parse(text);
    } catch {
      return Response.json({ error: `NVIDIA API returned non-JSON: ${text.slice(0, 300)}` }, { status: 502 });
    }

    if (!res.ok || json.error) {
      const msg = json.error?.message ?? `NVIDIA API returned ${res.status}`;
      return Response.json({ error: msg }, { status: 502 });
    }

    const reply = json.choices?.[0]?.message?.content ?? "";
    if (!reply) {
      return Response.json({ error: "NVIDIA API returned empty response" }, { status: 502 });
    }

    return Response.json({ ok: true, reply });
  } catch (err) {
    console.error("AI chat error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to generate response" },
      { status: 500 },
    );
  }
}