"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import { ArrowRight, Leaf, Satellite, Shield, Sprout, DollarSign, CheckCircle } from "lucide-react";

gsap.registerPlugin(useGSAP);

const ThreeGlobe = dynamic(() => import("@/components/ThreeGlobe"), { ssr: false });

type Props = {
  listingCount: number;
  buyableCount: number;
  totalVolume: number;
  farmerCount: number;
};

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function useCountUp(end: number, duration: number, started: boolean) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  const startTime = useRef<number>(0);

  useEffect(() => {
    if (!started) return;
    startTime.current = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      setValue(Math.round(end * easeOutExpo(progress)));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [end, duration, started]);

  return value;
}

function StatCounter({ end, label, prefix, started }: { end: number; label: string; prefix?: string; started: boolean }) {
  const value = useCountUp(end, 2.5, started);
  const formatted = prefix ? `${prefix}${value.toLocaleString()}` : value.toLocaleString();

  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold tabular-nums text-farm-900 sm:text-3xl lg:text-4xl">
        {formatted}
      </span>
      <span className="mt-1 text-xs font-medium uppercase tracking-widest text-stone-500">
        {label}
      </span>
    </div>
  );
}


export default function HeroComponent({ listingCount, buyableCount, totalVolume, farmerCount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const countersRef = useRef<HTMLDivElement>(null);
  const [countersStarted, setCountersStarted] = useState(false);

  const startCounters = useCallback(() => setCountersStarted(true), []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          const reduceMotion = ctx.conditions?.reduceMotion ?? false;
          const dur = reduceMotion ? 0.1 : 0.8;

          gsap.fromTo(".hero-badge", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: dur, ease: "power3.out" });
          gsap.fromTo(".hero-headline-word", { opacity: 0, y: 40, rotationX: -20 }, { opacity: 1, y: 0, rotationX: 0, duration: dur * 1.2, stagger: reduceMotion ? 0 : 0.12, ease: "power3.out", delay: 0.2 });
          gsap.fromTo(".hero-subtitle", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: dur, ease: "power2.out", delay: 0.7 });
          gsap.fromTo(".hero-cta", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: dur, stagger: 0.1, ease: "back.out(1.4)", delay: 0.9 });
          gsap.fromTo(".hero-feature-card", { opacity: 0, y: 30, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: dur, stagger: reduceMotion ? 0 : 0.15, ease: "power2.out", delay: 1.1 });

          const trigger = gsap.fromTo(".hero-stats", { opacity: 0.5, scale: 0.8 }, { opacity: 1, scale: 1, duration: reduceMotion ? 0 : 1, ease: "power3.out", paused: true, onStart: startCounters });
          gsap.to(trigger, { scrollTrigger: { trigger: countersRef.current, start: "top 85%", onEnter: () => trigger.play() } });
          return () => { trigger.kill(); };
        },
        containerRef,
      );
    },
    { scope: containerRef },
  );

  const hasData = listingCount > 0;

  return (
    <section ref={containerRef} className="relative overflow-hidden bg-gradient-to-b from-lime-50/70 via-emerald-50/40 to-transparent pb-16 pt-10 sm:pb-20 sm:pt-16 lg:pb-28 lg:pt-24">
      <ThreeGlobe />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="hero-badge mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-800 backdrop-blur-sm">
            <Satellite size={14} />
            Powered by Copernicus Sentinel-2
          </span>
        </div>

        <h1 className="mx-auto max-w-4xl text-center font-display text-3xl font-bold leading-tight tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
          <span className="hero-headline-word block sm:inline">Agricultural </span>
          <span className="hero-headline-word block sm:inline">Forward </span>
          <span className="hero-headline-word block sm:inline">Contracts, </span>
          <span className="hero-headline-word block sm:inline text-emerald-800">Verified by </span>
          <span className="hero-headline-word block sm:inline text-emerald-800">Satellite</span>
        </h1>

        <p className="hero-subtitle mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-stone-500 sm:text-base">
          Buy and sell crop yields before harvest on Stellar. Every parcel is verified by
          Copernicus NDVI analysis &mdash; real satellite data, not paperwork.
        </p>

        <div className="hero-cta mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/marketplace" className="inline-flex items-center gap-2 rounded-xl bg-farm-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-farm-900/20 transition hover:bg-farm-800 hover:shadow-farm-900/30 active:scale-[0.98]">
            Explore Marketplace <ArrowRight size={16} />
          </Link>
          <Link href="/explore" className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-farm-400 hover:text-farm-800 active:scale-[0.98]">
            Verify a Parcel <Satellite size={16} />
          </Link>
        </div>

        <div className="hero-feature-card mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Sprout, title: "Tokenized Crops", desc: "Every crop lot is a verifiable NFT on Stellar Soroban with full provenance." },
            { icon: Satellite, title: "Satellite Verification", desc: "Copernicus Sentinel-2 NDVI analysis gates buyability with real vegetation data." },
            { icon: Shield, title: "Smart Escrow", desc: "XLM payments held in escrow. 70% on delivery, 20% upfront, 10% to farmer aid pool." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-stone-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition hover:border-emerald-200 hover:shadow-md">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><Icon size={20} /></div>
              <h3 className="text-sm font-bold text-stone-900">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">{desc}</p>
            </div>
          ))}
        </div>

        {hasData && (
          <div ref={countersRef} className="hero-stats mt-16 sm:mt-20">
            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-12 gap-y-6 rounded-3xl border border-stone-200/60 bg-white/70 px-6 py-8 backdrop-blur-sm sm:gap-x-20 sm:py-10">
              <StatCounter end={listingCount} label="Parcels Listed" started={countersStarted} />
              <StatCounter end={totalVolume} label="Market Volume" prefix="$" started={countersStarted} />
              <StatCounter end={buyableCount} label="Buyable Now" started={countersStarted} />
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Leaf size={16} className="text-farm-600" />
                <span>On-Chain &middot; Auditable &middot; Transparent</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}