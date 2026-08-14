const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";

export async function nvidiaFetch(
  path: string,
  options: { method: string; headers: Record<string, string>; body: string },
  retries = 2,
): Promise<Response> {
  const url = `${NVIDIA_BASE}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 300 * attempt * attempt));
    }
    try {
      const res = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok && attempt < retries) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("nvidiaFetch failed");
}

export function getNvidiaConfig() {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.NIM_TOKEN;
  if (!apiKey || apiKey.trim() === "") return null;
  return { apiKey, model: process.env.AI_MODEL ?? "meta/llama-3.3-70b-instruct" };
}
