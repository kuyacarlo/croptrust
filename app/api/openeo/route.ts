export const runtime = "nodejs";

type Json = Record<string, unknown>;

function trimSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as Json;
}

export async function GET() {
  try {
    const base = trimSlash(
      process.env.OPENEO_BASE_URL ?? "https://openeo.dataspace.copernicus.eu",
    );
    const clientId = process.env.OPENEO_CLIENT_ID ?? "";
    const clientSecret = process.env.OPENEO_CLIENT_SECRET ?? "";

    const wellKnown = (await fetchJson(`${base}/.well-known/openeo`)) as {
      api_version?: string;
      versions?: Array<{ url?: string; api_version?: string }>;
    };

    const apiUrl =
      wellKnown.versions?.find((v) => Boolean(v.url))?.url ?? `${base}/1.2.0`;
    const normalizedApiUrl = trimSlash(apiUrl);

    const [collections, processes] = await Promise.all([
      fetchJson(`${normalizedApiUrl}/collections`),
      fetchJson(`${normalizedApiUrl}/processes`),
    ]);

    let authStatus = "anonymous";
    let providerId: string | null = null;

    if (clientId && clientSecret) {
      try {
        const oidc = (await fetchJson(`${normalizedApiUrl}/credentials/oidc`)) as {
          providers?: Array<{
            id?: string;
            issuer?: string;
          }>;
        };

        const provider = oidc.providers?.[0];
        if (provider?.issuer && provider?.id) {
          providerId = provider.id;

          const discovery = (await fetchJson(
            `${trimSlash(provider.issuer)}/.well-known/openid-configuration`,
          )) as {
            token_endpoint?: string;
          };

          if (discovery.token_endpoint) {
            const body = new URLSearchParams({
              grant_type: "client_credentials",
              client_id: clientId,
              client_secret: clientSecret,
            });

            const tokenRes = await fetch(discovery.token_endpoint, {
              method: "POST",
              headers: { "content-type": "application/x-www-form-urlencoded" },
              body,
            });

            if (tokenRes.ok) {
              authStatus = "client_credentials_ok";
            } else {
              authStatus = "client_credentials_failed";
            }
          }
        }
      } catch {
        authStatus = "client_credentials_failed";
      }
    }

    return Response.json({
      ok: true,
      endpoint: normalizedApiUrl,
      apiVersion: wellKnown.api_version ?? "unknown",
      collections: Array.isArray(collections.collections)
        ? collections.collections.length
        : 0,
      processes: Array.isArray(processes.processes) ? processes.processes.length : 0,
      authStatus,
      providerId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "openEO status check failed";
    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
