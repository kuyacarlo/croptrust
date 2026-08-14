"use client";

import { useState, useCallback } from "react";
import { CheckCircle, ChevronDown, ChevronUp, Loader2, XCircle, Wallet } from "lucide-react";

import { useWallet } from "@/components/stellar/wallet-context";
import { CONTRACT_IDS } from "@/lib/stellar/config";
import { STELLAR_RPC_URL, STELLAR_HORIZON_URL, STELLAR_NETWORK_PASSPHRASE } from "@/lib/stellar/config";

type Props = {
  nftId: number;
  bbox: { west: number; south: number; east: number; north: number };
  minNdviBps?: number;
  temporalExtent?: { start: string; end: string };
  sampleGridSize?: number;
  onNdviResult?: (ndviBps: number) => void;
  compact?: boolean;
};

type SubmissionResult = {
  hash: string;
  status: string;
};

type RunResponse =
  |     {
      ok: true;
      nftId: number;
      bbox: { west: number; south: number; east: number; north: number };
      temporalExtent: { start: string; end: string };
      ndviMean: number;
      ndviBps: number;
      minNdviBps: number;
      buyable: boolean;
      sampleGridSize: number;
      isPreview: boolean;
      attestation: {
        observedAt: number;
        bboxHash: string;
        reportHash: string;
        source: string;
      };
      submissionResult: SubmissionResult | null;
    }
  | { ok: false; error: string; details?: string; raw?: string };

type SummaryResponse = {
  ok?: boolean;
  summary: string;
  recommendation: string;
  healthLabel: string;
  ndviPercent: string;
  vegHealth: string;
};

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function ndviColor(bps: number) {
  if (bps >= 6000) return "text-farm-600";
  if (bps >= 4000) return "text-harvest-600";
  if (bps >= 2000) return "text-amber-600";
  return "text-red-600";
}

export default function SatelliteVerificationPanel({
  nftId,
  bbox,
  minNdviBps = 3500,
  temporalExtent,
  sampleGridSize = 16,
  onNdviResult,
  compact,
}: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [autoSubmitHash, setAutoSubmitHash] = useState<string | null>(null);
  const [autoSubmitStatus, setAutoSubmitStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState<{
    amount: string;
    destination: string;
    memo?: string;
  } | null>(null);

  const busy = isRunning || paymentRequired !== null;

  const fetchSummary = useCallback(
    async (rawBps: number) => {
      setSummaryLoading(true);
      setSummary(null);
      try {
        const res = await fetch("/api/ai/ndvi-summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ndviBps: rawBps }),
        });
        if (res.ok) {
          const data = (await res.json()) as SummaryResponse;
          setSummary(data);
        }
      } catch {
        // Non-critical — summary display fails silently.
      } finally {
        setSummaryLoading(false);
      }
    },
    [],
  );

  async function run() {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setSummary(null);
    setAutoSubmitted(false);
    setAutoSubmitHash(null);
    setAutoSubmitStatus(null);
    setShowDetails(false);
    setPaymentRequired(null);
    try {
      const res = await fetch("/api/verification/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nftId, bbox, minNdviBps, temporalExtent, sampleGridSize }),
      });

      if (res.status === 402) {
        const body = await res.json() as { amount: string; destination: string; memo?: string };
        setPaymentRequired({ amount: body.amount, destination: body.destination, memo: body.memo });
        return;
      }

      const json = (await res.json()) as RunResponse;
      setResult(json);
      if (json.ok) {
        if (json.submissionResult) {
          setAutoSubmitted(true);
          setAutoSubmitHash(json.submissionResult.hash);
          setAutoSubmitStatus(json.submissionResult.status);
        }
        void fetchSummary(json.ndviBps);
        onNdviResult?.(json.ndviBps);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run verification");
    } finally {
      setIsRunning(false);
    }
  }

  async function payAndRetry() {
    if (!paymentRequired || !address) return;
    setIsRunning(true);
    setPaymentRequired(null);
    try {
      const { Horizon, TransactionBuilder, BASE_FEE, TimeoutInfinite, Keypair, Operation } = await import("@stellar/stellar-sdk");
      const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit");

      const server = new Horizon.Server(STELLAR_HORIZON_URL, { allowHttp: STELLAR_HORIZON_URL.startsWith("http://") });
      const account = await server.loadAccount(address);
      const amount = parseFloat(paymentRequired.amount).toFixed(7);

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      })
        .addOperation(Operation.payment({
          destination: paymentRequired.destination,
          asset: Horizon.Asset.native(),
          amount,
        }))
        .setTimeout(30)
        .build();

      const txXdr = tx.toXDR();
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(txXdr, {
        address,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      });

      const signedTx = TransactionBuilder.fromXDR(signedTxXdr, STELLAR_NETWORK_PASSPHRASE);
      const submitRes = await server.submitTransaction(signedTx);
      const txHash = submitRes.hash;

      const retryRes = await fetch("/api/verification/run", {
        method: "POST",
        headers: { "content-type": "application/json", "x-stellar-payment": txHash },
        body: JSON.stringify({ nftId, bbox, minNdviBps, temporalExtent, sampleGridSize }),
      });

      if (retryRes.status === 402) {
        setError("Payment verification failed. Try again.");
        return;
      }

      const json = (await retryRes.json()) as RunResponse;
      setResult(json);
      if (json.ok) {
        if (json.submissionResult) {
          setAutoSubmitted(true);
          setAutoSubmitHash(json.submissionResult.hash);
          setAutoSubmitStatus(json.submissionResult.status);
        }
        void fetchSummary(json.ndviBps);
        onNdviResult?.(json.ndviBps);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* --- Run button --- */}
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-farm-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
      >
        {isRunning && <Loader2 size={15} className="animate-spin" />}
        {isRunning ? "Running NDVI check..." : "Run NDVI check"}
      </button>

      {/* --- x402 payment gate --- */}
      {paymentRequired && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
          <Wallet size={20} className="mx-auto mb-2 text-amber-600" />
          <p className="text-sm font-semibold text-amber-800">Payment Required</p>
          <p className="mt-1 text-xs text-amber-700">
            Pay <span className="font-bold">{paymentRequired.amount} XLM</span> to run NDVI verification
          </p>
          <button
            onClick={payAndRetry}
            disabled={!address}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
          >
            <Wallet size={14} />
            {address ? "Pay & Verify" : "Connect Wallet First"}
          </button>
        </div>
      )}

      {/* --- Error --- */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* --- Not buyable fallback --- */}
      {result && !result.ok && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          {result.error}
          {result.details ? `. ${result.details}` : ""}
        </div>
      )}

      {/* --- Result card --- */}
      {result?.ok && (
        <div className="rounded-xl border border-farm-200/60 bg-farm-50/40 p-3">
          {/* Status + NDVI value row */}
          <div className="flex items-center gap-2">
            {result.buyable ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-farm-100 px-2 py-0.5 text-[11px] font-medium text-farm-700">
                <CheckCircle size={12} />
                Buyable
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                <XCircle size={12} />
                Hold
              </span>
            )}
            <span
              className={`text-sm font-bold tabular-nums ${ndviColor(result.ndviBps)}`}
            >
              {result.ndviMean.toFixed(3)} NDVI
            </span>
            <span className="text-[11px] text-stone-400">
              ≥ {(result.minNdviBps / 10000).toFixed(2)} required
            </span>
          </div>

          {/* AI Summary */}
          {(summary || summaryLoading) && (
            <div className="mt-2.5 rounded-lg border border-stone-200 bg-white px-3 py-2.5">
              {summaryLoading ? (
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <Loader2 size={12} className="animate-spin" />
                  Analyzing satellite data...
                </div>
              ) : summary ? (
                <>
                  <p className="text-xs leading-relaxed text-stone-700">
                    {summary.summary}
                  </p>
                  <p className="mt-1.5 text-[11px] font-medium text-farm-700">
                    {summary.recommendation}
                  </p>
                </>
              ) : null}
            </div>
          )}

          {/* Expand details */}
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 transition"
          >
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showDetails ? "Hide details" : "Details"}
          </button>

          {showDetails && (
            <div className="mt-2 space-y-1 rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2 text-[11px] text-stone-500">
              <div className="flex justify-between gap-2">
                <span>Grid</span>
                <span className="font-mono">
                  {result.sampleGridSize}&times;{result.sampleGridSize}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Window</span>
                <span className="font-mono text-right">
                  {result.temporalExtent.start.slice(0, 10)} &rarr;{" "}
                  {result.temporalExtent.end.slice(0, 10)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Observed</span>
                <span className="font-mono">
                  {new Date(result.attestation.observedAt * 1000).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Source</span>
                <span className="font-mono">{result.attestation.source}</span>
              </div>
            </div>
          )}

          {/* Auto-submission status */}
          {autoSubmitted && (
            <div className="mt-3 rounded-xl border border-farm-200 bg-farm-50 px-4 py-2.5">
              <p className="text-xs font-medium text-farm-700">
                Attestation recorded on-chain
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${autoSubmitHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-mono text-farm-600 underline underline-offset-2 hover:text-farm-800"
                >
                  View Tx →
                </a>
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_IDS.agriCon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-mono text-farm-600 underline underline-offset-2 hover:text-farm-800"
                >
                  View Contract →
                </a>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}