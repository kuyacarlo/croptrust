"use client";

import { useEffect, useState } from "react";
import { PiggyBank, ArrowDownRight, Users } from "lucide-react";

export default function LiquidityPool() {
  const [poolBalance, setPoolBalance] = useState<number>(0);

  useEffect(() => {
    async function fetchPool() {
      try {
        const res = await fetch("/api/stellar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_treasury_pool" }),
        });
        const data = await res.json();
        if (data.ok && typeof data.balance === "number") {
          setPoolBalance(data.balance / 10_000_000);
        }
      } catch {}
    }
    fetchPool();
  }, []);

  const totalDistributed = 0;
  const farmersAided = 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-harvest-100 text-harvest-700">
            <PiggyBank size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900">Treasury Pool</h2>
            <p className="text-xs text-stone-500">Funded by 10% of every transaction</p>
          </div>
        </div>
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Pool Balance</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-stone-900">
            {poolBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="ml-1 text-sm font-normal text-stone-500">XLM</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-stone-900">Payment Split</h3>
        {[
          { label: "Farmer Upfront", pct: 20, color: "bg-farm-500", desc: "Paid immediately on purchase" },
          { label: "Escrow Hold", pct: 70, color: "bg-harvest-500", desc: "Released after delivery verified" },
          { label: "Treasury Pool", pct: 10, color: "bg-soil-500", desc: "Emergency aid for disaster claims" },
        ].map(({ label, pct, color, desc }) => (
          <div key={label} className="mb-2 flex items-center gap-3">
            <span className="w-8 text-xs font-mono text-stone-500">{pct}%</span>
            <div className="flex-1">
              <div className="h-2.5 w-full rounded-full bg-stone-100">
                <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-stone-700">{label}</p>
              <p className="text-[10px] text-stone-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-farm-700">
            <ArrowDownRight size={14} /> <span className="text-xs font-medium">Total Distributed</span>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-stone-900">On-chain</p>
        </div>
        <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-soil-600">
            <Users size={14} /> <span className="text-xs font-medium">Farmers Aided</span>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-stone-900">On-chain</p>
        </div>
      </div>
    </div>
  );
}