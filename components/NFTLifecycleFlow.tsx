"use client";

import { useRef } from "react";
import { gsap } from "@/lib/gsap-config";
import { useGSAP } from "@gsap/react";
import { Leaf, ShieldCheck, HandCoins, Sprout, CheckCircle } from "lucide-react";

gsap.registerPlugin(useGSAP);

export type NftStep = "minted" | "listed" | "purchased" | "growing" | "verified" | "settled";

const STEPS: { key: NftStep; label: string; icon: typeof Leaf; desc: string }[] = [
  { key: "minted", label: "Minted", icon: Leaf, desc: "Crop NFT created on-chain" },
  { key: "listed", label: "Listed", icon: Sprout, desc: "Available in marketplace" },
  { key: "purchased", label: "Purchased", icon: HandCoins, desc: "Buyer reserves with XLM" },
  { key: "growing", label: "Growing", icon: Sprout, desc: "Farmer tends the crop" },
  { key: "verified", label: "Verified", icon: ShieldCheck, desc: "Validator confirms delivery" },
  { key: "settled", label: "Settled", icon: CheckCircle, desc: "Escrow released to farmer" },
];

const ORDER = STEPS.map((s) => s.key);

interface Props {
  current: NftStep;
  compact?: boolean;
}

export default function NFTLifecycleFlow({ current, compact = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentIdx = ORDER.indexOf(current);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          const reduce = ctx.conditions?.reduceMotion ?? false;
          const steps = containerRef.current?.children;

          if (steps) {
            gsap.fromTo(
              steps,
              { opacity: reduce ? 1 : 0, y: reduce ? 0 : 16, scale: reduce ? 1 : 0.96 },
              {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: reduce ? 0.05 : 0.45,
                stagger: reduce ? 0 : 0.08,
                ease: "power2.out",
              },
            );
          }

          // Pulse the active step
          const activeStep = containerRef.current?.querySelector(".nft-step-active");
          if (activeStep && !reduce) {
            gsap.to(activeStep, {
              boxShadow: "0 0 0 4px rgba(22,163,74,0.15)",
              duration: 1.5,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
            });
          }
        },
        containerRef,
      );
    },
    { scope: containerRef },
  );

  return (
    <div
      ref={containerRef}
      className={`flex ${compact ? "flex-col gap-2" : "flex-wrap gap-3 sm:gap-4"}`}
    >
      {STEPS.map((step, i) => {
        const state =
          i < currentIdx ? "done" : i === currentIdx ? "active" : "idle";
        const Icon = step.icon;

        return (
          <div
            key={step.key}
            className={`nft-step ${state === "active" ? "nft-step-active" : state === "done" ? "nft-step-done" : "nft-step-idle"} ${
              compact ? "flex-1" : "flex-1 min-w-[140px]"
            }`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                state === "active"
                  ? "bg-farm-200 text-farm-700"
                  : state === "done"
                    ? "bg-farm-100 text-farm-600"
                    : "bg-stone-100 text-stone-400"
              }`}
            >
              {state === "done" ? (
                <CheckCircle size={18} />
              ) : (
                <Icon size={18} />
              )}
            </div>
            {!compact && (
              <div className="min-w-0">
                <p className="text-xs font-bold">{step.label}</p>
                <p className="text-[11px] opacity-70">{step.desc}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}