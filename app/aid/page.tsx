"use client";

import { useState } from "react";
import NavigationBar from "@/components/NavigationBar";
import { useWallet } from "@/components/stellar/wallet-context";
import { signPreparedXdr, submitSignedXdr } from "@/lib/stellar/croptrust";
import { AlertTriangle, Send, Loader2, History, CheckCircle, XCircle, Clock } from "lucide-react";

type Claim = {
  id: string;
  nftId: number;
  reason: string;
  timestamp: number;
  status: "pending" | "approved" | "rejected";
};

export default function AidPage() {
  const { address } = useWallet();
  const [nftId, setNftId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);

  const handleSubmit = async () => {
    if (!address || !nftId || !reason) return;
    setSubmitting(true);
    try {
      const prepareRes = await fetch("/api/stellar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare_submit_proof",
          farmer: address,
          nftId: parseInt(nftId, 10),
          proofHash: reason.slice(0, 64),
        }),
      });
      const prepared = await prepareRes.json();
      if (!prepared.xdr) {
        throw new Error(prepared.error ?? "Failed to prepare proof submission");
      }

      const { signedTxXdr } = await signPreparedXdr(address, prepared.xdr);
      const submission = await submitSignedXdr(signedTxXdr);

      setClaims((prev) => [{
        id: String(Date.now()),
        nftId: parseInt(nftId, 10),
        reason,
        timestamp: Date.now(),
        status: "pending",
      }, ...prev]);
      setNftId("");
      setReason("");
    } catch {} finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <NavigationBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900">
                Disaster Aid
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                File a claim for crop loss due to natural disasters
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Submit claim */}
          <div className="card-farm p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900">Request Disaster Aid</h2>
                <p className="text-xs text-stone-500">File a claim for crop loss due to natural disaster</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500">Crop NFT ID</label>
                <input
                  type="number"
                  value={nftId}
                  onChange={(e) => setNftId(e.target.value)}
                  placeholder="e.g. 3"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-farm-400 focus:ring-2 focus:ring-farm-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Describe the damage (typhoon, flood, drought)..."
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-farm-400 focus:ring-2 focus:ring-farm-100 resize-none"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !nftId || !reason || !address}
                className="btn-primary w-full justify-center"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Submit Claim</>}
              </button>
            </div>
          </div>

          {/* Claim history */}
          <div className="card-farm p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <History size={18} className="text-stone-400" />
              <h2 className="text-sm font-bold text-stone-900">Claim History</h2>
            </div>
            {claims.length === 0 ? (
              <div className="flex flex-col items-center py-10">
                <History size={32} className="mb-2 text-stone-200" />
                <p className="text-sm font-medium text-stone-400">No claims filed yet</p>
                <p className="mt-1 text-xs text-stone-300">Submitted claims will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {claims.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-stone-100 px-4 py-3 transition hover:border-stone-200">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-800">NFT #{c.nftId}: {c.reason.slice(0, 60)}</p>
                      <p className="flex items-center gap-1 text-xs text-stone-400">
                        <Clock size={11} /> {new Date(c.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`ml-3 shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.status === "approved" ? "badge-buyable" : c.status === "rejected" ? "badge-alert" : "badge-pending"
                    }`}>
                      {c.status === "approved" ? <CheckCircle size={12} /> : c.status === "rejected" ? <XCircle size={12} /> : null}
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}