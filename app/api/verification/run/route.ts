export const runtime = "nodejs";

import { createHash } from "node:crypto";
import { submitRecordSatelliteAttestation } from "@/lib/stellar/backend";
import { getAdminSecretKey } from "@/lib/stellar/config";
import { createPaymentRequiredResponse, processPaymentMiddleware } from "x402-stellar-sdk";

type BBox = { west: number; south: number; east: number; north: number };
type Body = {
  nftId: number;
  bbox: BBox;
  sampleGridSize?: number;
  // Optional. Defaults to last 30 days.
  temporalExtent?: { start: string; end: string };
  // Optional. Basis points (0-10000). Defaults to 3500 (~0.35 NDVI).
  minNdviBps?: number;
};

type Json = Record<string, unknown>;

type PreparedTx = {
  xdr: string;
  hash: string;
  contractId: string;
  method: string;
};

type SubmitResult = {
  hash: string;
  status: string;
};

type AttestationPayload = {
  observedAt: number;
  bboxHash: string;
  reportHash: string;
  source: string;
};

function trimSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as Json;
}

async function fetchJsonWithRetry(url: string, init?: RequestInit, retries = 3): Promise<Json> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchJson(url, init);
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("unreachable");
}

async function fetchWithRetry(url: string, init?: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("unreachable");
}

async function resolveOpenEoApiBase(openeoBase: string) {
  const normalizedBase = trimSlash(openeoBase);
  const wellKnown = (await fetchJson(`${normalizedBase}/.well-known/openeo`)) as {
    versions?: Array<{ url?: string }>;
  };
  const discovered = wellKnown.versions?.find((entry) => Boolean(entry.url))?.url;
  return trimSlash(discovered ?? `${normalizedBase}/1.2.0`);
}

async function getOidcAccessToken(openeoApiBase: string) {
  const clientId = process.env.OPENEO_CLIENT_ID ?? "";
  const clientSecret = process.env.OPENEO_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("Missing OPENEO_CLIENT_ID/OPENEO_CLIENT_SECRET");
  }

  const oidc = (await fetchJsonWithRetry(`${openeoApiBase}/credentials/oidc`)) as {
    providers?: Array<{ id?: string; issuer?: string }>;
  };
  const provider = oidc.providers?.find((p) => p.issuer)?.issuer;
  if (!provider) {
    throw new Error("No OIDC issuer found from /credentials/oidc");
  }

  const discovery = (await fetchJsonWithRetry(
    `${trimSlash(provider)}/.well-known/openid-configuration`,
  )) as { token_endpoint?: string };
  if (!discovery.token_endpoint) {
    throw new Error("OIDC discovery missing token_endpoint");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const tokenRes = await fetchWithRetry(discovery.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    throw new Error(`OIDC token request failed (${tokenRes.status}): ${tokenText.slice(0, 200)}`);
  }
  const tokenJson = JSON.parse(tokenText) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("OIDC token response missing access_token");
  }
  return tokenJson.access_token;
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10) + "T00:00:00Z";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidBBox(bbox: BBox) {
  return (
    isFiniteNumber(bbox.west) &&
    isFiniteNumber(bbox.south) &&
    isFiniteNumber(bbox.east) &&
    isFiniteNumber(bbox.north) &&
    (bbox.west === 0 && bbox.east === 0 && bbox.south === 0 && bbox.north === 0 ||
     bbox.west < bbox.east && bbox.south < bbox.north)
  );
}

function clampSampleGridSize(value: unknown) {
  if (!isFiniteNumber(value)) {
    return 16;
  }

  return Math.max(4, Math.min(64, Math.round(value)));
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function decodeNdviMeanFromGeoTiff(input: ArrayBuffer) {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const { data, info } = await sharp(Buffer.from(input))
    .raw({ depth: "float" })
    .toBuffer({ resolveWithObject: true });

  const floatValues = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
  let sum = 0;
  let count = 0;

  const channels = Math.max(info.channels, 1);
  for (let index = 0; index < floatValues.length; index += channels) {
    const value = floatValues[index];
    if (Number.isFinite(value) && value >= -1 && value <= 1) {
      sum += value;
      count += 1;
    }
  }

  if (count === 0) {
    return null;
  }

  return sum / count;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (body?.nftId == null || !body?.bbox) {
      return Response.json({ ok: false, error: "Missing nftId/bbox" }, { status: 400 });
    }
    if (!Number.isInteger(body.nftId) || body.nftId < 0) {
      return Response.json({ ok: false, error: "nftId must be a non-negative integer" }, { status: 400 });
    }
    if (!isValidBBox(body.bbox)) {
      return Response.json({ ok: false, error: "bbox is invalid" }, { status: 400 });
    }

    const isPreview = body.nftId === 0;

    // ── x402 payment gate ──
    if (!isPreview) {
      const txHash = req.headers.get("x-402-transaction-hash") ?? "";
      const destination = (process.env.TREASURY_ADDRESS || process.env.NEXT_PUBLIC_TREASURY_ADDRESS) ?? "";
      const price = process.env.X402_PRICE ?? "0.1";

      if (!txHash) {
        const paymentReq = createPaymentRequiredResponse({
          price,
          assetCode: "XLM",
          network: "testnet",
          destination,
          memo: `ndvi-${body.nftId}`,
        });
        return Response.json(paymentReq.body, { status: 402, headers: new Headers(paymentReq.headers) });
      }

      const verified = await processPaymentMiddleware(
        { "x-402-transaction-hash": txHash },
        { price, assetCode: "XLM", network: "testnet", destination, memo: `ndvi-${body.nftId}` },
      );
      if (!verified.allowed) {
        return Response.json({ ok: false, error: "Payment verification failed" }, { status: 402 });
      }
    }

    const openeoSh = trimSlash(
      process.env.OPENEO_SH_BASE_URL ?? "https://openeosh.dataspace.copernicus.eu",
    );
    const openeoApiBase = await resolveOpenEoApiBase(openeoSh);

    const token = await getOidcAccessToken(openeoApiBase);

    const temporalExtent = body.temporalExtent ?? {
      start: daysAgoIso(30),
      end: new Date().toISOString().slice(0, 10) + "T23:59:59Z",
    };

    const minNdviBps = typeof body.minNdviBps === "number" ? body.minNdviBps : 3500;
    const sampleGridSize = clampSampleGridSize(body.sampleGridSize);

    // Process graph:
    // - load a small NDVI raster over the selected bbox
    // - save as GeoTIFF, which the synchronous backend documents as supported
    // The synchronous Sentinel Hub openEO backend supports single-slice raster operations,
    // but not the spatial aggregation processes we originally attempted to use.
    const processBody = {
      process: {
        process_graph: {
          loadcollection: {
            process_id: "load_collection",
            arguments: {
              id: "sentinel-2-l2a",
              spatial_extent: {
                ...body.bbox,
                width: sampleGridSize,
                height: sampleGridSize,
              },
              temporal_extent: [temporalExtent.start, temporalExtent.end],
              bands: ["B04", "B08"],
            },
          },
          ndvi1: {
            process_id: "ndvi",
            arguments: {
              data: { from_node: "loadcollection" },
              nir: "B08",
              red: "B04",
              target_band: "NDVI",
            },
          },
          save: {
            process_id: "save_result",
            arguments: { data: { from_node: "ndvi1" }, format: "GTIFF" },
            result: true,
          },
        },
        parameters: [],
      },
    };

    const resultRes = await fetchWithRetry(`${openeoApiBase}/result`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(processBody),
    });

    // /result returns raw content in the chosen output format; for JSON this should be JSON.
    if (!resultRes.ok) {
      const resultText = await resultRes.text();
      return Response.json(
        { ok: false, error: `openEO /result failed (${resultRes.status})`, details: resultText.slice(0, 500) },
        { status: 502 },
      );
    }

    let ndviValue: number | null = null;
    try {
      const raster = await resultRes.arrayBuffer();
      ndviValue = await decodeNdviMeanFromGeoTiff(raster);
    } catch {
      // If raster decoding fails, keep null and return diagnostics.
    }

    if (ndviValue === null) {
      return Response.json(
        { ok: false, error: "Could not decode NDVI GeoTIFF result" },
        { status: 502 },
      );
    }

    const rawNdviBps = Math.round(ndviValue * 10000);
    const ndviBps = Math.max(0, rawNdviBps);
    const buyable = ndviBps >= minNdviBps;
    const observedAt = Math.floor(Date.now() / 1000);
    const source = "openEO-SentinelHub";
    const bboxHash = sha256Hex(JSON.stringify(body.bbox));
    const reportHash = sha256Hex(
      JSON.stringify({
        nftId: body.nftId,
        bbox: body.bbox,
        temporalExtent,
        sampleGridSize,
        ndviBps,
        minNdviBps,
        observedAt,
        source,
      }),
    );

    // Record attestation on-chain (server-side signing via the AI attestor /
    // admin wallet). Skip on-chain attestation for preview mode (nftId === 0).
    // The signer must be the on-chain admin (GBHBOPW5...MMZZ) because the
    // contract's record_satellite_attestation uses require_admin().
    const adminSecretKey = getAdminSecretKey();

    let submissionResult: SubmitResult | null = null;

    // Non-preview attestations REQUIRE a configured signer. Returning a silent
    // null here is what previously made the flow look like it "did nothing":
    // NDVI computed, but no on-chain attestation was ever recorded.
    if (!isPreview && !adminSecretKey) {
      return Response.json(
        {
          ok: false,
          error:
            "No attestor wallet configured: set ADMIN_SECRET_KEY (or STELLAR_ADMIN_SECRET / ORACLE_SECRET_KEY) to the secret key of the on-chain admin GBHBOPW5AMW5J6RRR4YU2NLJI3HRX7SG4Q4ZZBJILLDR3644INLHMMZZ. NDVI was computed but no attestation was recorded on-chain.",
          ndviBps,
          minNdviBps,
          buyable,
        },
        { status: 500 },
      );
    }

    if (!isPreview && adminSecretKey) {
      try {
        const result = await submitRecordSatelliteAttestation({
          adminSecretKey,
          nftId: body.nftId,
          observedAt,
          ndviBps,
          minNdviBps,
          bboxHash,
          reportHash,
          source,
        });
        submissionResult = {
          hash: result.hash ?? "",
          status: result.status ?? "UNKNOWN",
        };
      } catch (submitError) {
        const details =
          submitError instanceof Error
            ? submitError.message
            : String(submitError);
        return Response.json(
          {
            ok: false,
            error: "Failed to submit satellite attestation transaction",
            details,
          },
          { status: 502 },
        );
      }
    }

    return Response.json({
      ok: true,
      nftId: body.nftId,
      bbox: body.bbox,
      temporalExtent,
      ndviMean: ndviValue,
      rawNdviBps,
      ndviBps,
      minNdviBps,
      buyable,
      sampleGridSize,
      isPreview,
      attestation: {
        observedAt,
        bboxHash,
        reportHash,
        source,
      } satisfies AttestationPayload,
      submissionResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "verification run failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
